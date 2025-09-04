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
        get("/api/test/stream/{runId}") {
            // Headers that discourage buffering
            call.response.headers.append(HttpHeaders.CacheControl, "no-cache")
            call.response.headers.append(HttpHeaders.Connection, "keep-alive")
            call.response.headers.append("X-Accel-Buffering", "no") // nginx

            call.respondTextWriter(contentType = ContentType.Text.EventStream) {
                fun trySend(line: String): Boolean =
                    try {
                        write(line)
                        write("\n\n")
                        flush()
                        true
                    } catch (_: Throwable) {
                        false
                    } // includes ClosedWriteChannelException

                val runId = call.parameters["runId"]
                val req = RunStore.requests.remove(runId)
                if (req == null) {
                    trySend("event: done\ndata: {}")
                    return@respondTextWriter
                }

                // demo
                if (req.model.equals("demo", true) || req.model.equals("demo:demo", true)) {
                    val demo = listOf("Hello", " from", " prompt-hub!", " (runId=", runId, ")")
                    for (chunk in demo) {
                        if (!trySend("data: $chunk")) return@respondTextWriter
                        delay(200)
                    }
                    trySend("event: done\ndata: {}")
                    return@respondTextWriter
                }

                // real stream
                try {
                    val (client, model) = llmFor(req.model)
                    val flow = client.stream(model, req.prompt, req.input, req.temperature, req.maxTokens)

                    val job =
                        launch {
                            try {
                                flow.collect { token ->
                                    val safe = token.replace("\n", "\\n")
                                    if (!trySend("data: $safe")) throw CancellationException()
                                }
                                trySend("event: done\ndata: {}")
                            } catch (_: CancellationException) {
                                // client disconnected; just stop
                            }
                        }
                    job.join()
                } catch (e: Throwable) {
                    trySend("data: [provider error: ${e.message}]")
                    trySend("event: done\ndata: {}")
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
