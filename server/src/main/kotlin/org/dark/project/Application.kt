@file:Suppress("ktlint:standard:no-wildcard-imports")

package org.dark.project

import io.ktor.client.request.accept
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import org.dark.project.llm.LlmClient
import org.dark.project.llm.LmStudioClient
import org.dark.project.llm.OpenAiClient
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.cancellation.CancellationException

// ---------- Config & simple run store ----------

object RunStore {
    val requests = ConcurrentHashMap<String, TestRunRequest>()
    val inProgress = ConcurrentHashMap.newKeySet<String>()
}

fun llmFor(modelSpec: String): Pair<LlmClient, String> {
    val (provider, model) =
        modelSpec.split(":", limit = 2).let {
            if (it.size == 2) it[0] to it[1] else "demo" to modelSpec
        }
    return when (provider.lowercase()) {
        "lmstudio" -> LmStudioClient() to model
        "demo" -> error("demo should be handled before llmFor()") // safety
        else -> error("Unknown/disabled provider: $provider (only lmstudio|demo supported)")
    }
}

// ---------- Application ----------

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 5555
    embeddedServer(Netty, port = port, module = Application::module).start(wait = true)
}

fun Application.module() {
    install(CallLogging)
    install(CORS) {
        anyHost() // DEV ONLY. swap to allowHost("localhost:8080", listOf("http")) later

        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)

        // allow any header the browser asks for in preflight
        allowHeaders { true }

        allowNonSimpleContentTypes = true
    }

    install(ContentNegotiation) {
        json(
            kotlinx.serialization.json.Json {
                ignoreUnknownKeys = true
                explicitNulls = false
            },
        )
    }

    val lmStudio = LmStudioClient() // for /api/models

    routing {
        options("{...}") {
            call.respond(HttpStatusCode.OK)
        }

        get("/api/health") { call.respond(mapOf("ok" to true)) }

        // in Application.module() routing { ... }

        get("/api/models") {
            val provider = (call.request.queryParameters["provider"] ?: "").lowercase()
            when (provider) {
                "lmstudio" -> {
                    val base = System.getenv("LMSTUDIO_BASE") ?: "http://localhost:8000"
                    try {
                        val client = LmStudioClient(baseUrl = base)
                        val ids = client.listModels()
                        // helpful logs
                        log.info("LMStudio /v1/models -> ${ids.size} models: $ids")
                        call.respond(ModelsResponse(provider = "lmstudio", models = ids))
                    } catch (e: Throwable) {
                        // LOG the real error and return 502 with message so the browser shows it
                        call.application.environment.log
                            .error("LM Studio listModels failed", e)
                        call.respond(
                            HttpStatusCode.BadGateway,
                            mapOf("error" to "LmStudio /v1/models failed: ${e.message}"),
                        )
                    }
                }
                "openai" -> {
                    val env = System.getenv("OPENAI_MODELS") ?: ""
                    val list = env.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                    call.respond(ModelsResponse(provider = "openai", models = list))
                }
                else ->
                    call.respond(
                        HttpStatusCode.BadRequest,
                        mapOf("error" to "provider query param required (openai|lmstudio)"),
                    )
            }
        }

        // Start a run (store the request)
        post("/api/test/run") {
            val req = call.receive<TestRunRequest>()
            val runId = System.currentTimeMillis().toString()
            RunStore.requests[runId] = req
            call.respond(TestRunResponse(runId))
        }

        // Stream tokens for a run
        // /api/test/stream/{runId}
        get("/api/test/stream/{runId}") {
            call.response.cacheControl(CacheControl.NoCache(null))
            call.respondTextWriter(contentType = ContentType.Text.EventStream) {
                val runId = call.parameters["runId"] ?: return@respondTextWriter
                val req = RunStore.requests[runId]

                // no request or already taken
                if (req == null || !RunStore.inProgress.add(runId)) {
                    try {
                        write("event: done\ndata: {}\n\n")
                        flush()
                    } catch (_: Throwable) {
                    }
                    return@respondTextWriter
                }

                // keep a tiny heartbeat to prevent proxies from buffering
                fun heartbeat() {
                    try {
                        write(": keepalive\n\n")
                        flush()
                    } catch (_: Throwable) {
                    }
                }
                heartbeat()

                // DEMO path unchanged ...
                if (req.model.equals("demo", true) || req.model.equals("demo:demo", true)) {
                    for (chunk in listOf("Hello", " from", " prompt-hub!", " (runId=", runId, ")")) {
                        try {
                            write("data: $chunk\n\n")
                            flush()
                        } catch (_: Throwable) {
                            break
                        }
                        delay(150)
                    }
                    try {
                        write("event: done\ndata: {}\n\n")
                        flush()
                    } catch (_: Throwable) {
                    }
                    RunStore.requests.remove(runId)
                    RunStore.inProgress.remove(runId)
                    return@respondTextWriter
                }

                // REAL stream
                try {
                    val (client, model) = llmFor(req.model)
                    val flow = client.stream(model, req.prompt, req.input, req.temperature, req.maxTokens)

                    val job =
                        launch {
                            try {
                                flow.collect { token ->
                                    val safe = token.replace("\n", "\\n")
                                    try {
                                        write("data: $safe\n\n")
                                        flush()
                                    } catch (_: Throwable) {
                                        throw CancellationException() // client closed
                                    }
                                }
                                try {
                                    write("event: done\ndata: {}\n\n")
                                    flush()
                                } catch (_: Throwable) {
                                }
                            } catch (_: CancellationException) {
                                // silently stop on client disconnect
                            }
                        }
                    job.join()
                } catch (e: Throwable) {
                    try {
                        write("data: [provider error: ${e.message}]\n\n")
                        write("event: done\ndata: {}\n\n")
                        flush()
                    } catch (_: Throwable) {
                    }
                } finally {
                    RunStore.requests.remove(runId)
                    RunStore.inProgress.remove(runId)
                }
            }
        }
    }
}

// ---------- DTOs ----------

@Serializable
data class TestRunRequest(
    val prompt: String,
    val input: String? = null,
    /** Use "openai:gpt-4o-mini", "lmstudio:phi-3", or "demo" */
    val model: String,
    val temperature: Double? = null,
    val maxTokens: Int? = null,
)

@Serializable
data class TestRunResponse(
    val runId: String,
)

@Serializable
data class ModelsResponse(
    val provider: String,
    val models: List<String>,
)
