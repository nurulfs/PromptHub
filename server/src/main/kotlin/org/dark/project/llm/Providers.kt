@file:Suppress("ktlint:standard:import-ordering", "ktlint:standard:no-wildcard-imports")

package org.dark.project.llm

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.utils.io.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

interface LlmClient {
    /** Stream tokens as they arrive. */
    fun stream(
        model: String,
        prompt: String,
        input: String?,
        temperature: Double? = null,
        maxTokens: Int? = null,
    ): Flow<String>
}

// ---------- OpenAI (official API) ----------

class OpenAiClient(
    private val apiKey: String,
    private val baseUrl: String = "https://api.openai.com",
) : LlmClient {
    private val json = Json { ignoreUnknownKeys = true }
    private val http =
        HttpClient(CIO) {
            install(ContentNegotiation) { json(this@OpenAiClient.json) }
            install(Logging) { level = LogLevel.NONE }
        }

    @Serializable
    private data class ChatReq(
        val model: String,
        val messages: List<Msg>,
        val temperature: Double? = null,
        @SerialName("max_tokens") val maxTokens: Int? = null,
        val stream: Boolean = true,
    )

    @Serializable
    private data class Msg(
        val role: String,
        val content: String,
    )

    // streaming response (Server-Sent-Events style: "data: {...}")
    override fun stream(
        model: String,
        prompt: String,
        input: String?,
        temperature: Double?,
        maxTokens: Int?,
    ): Flow<String> =
        channelFlow {
            val userContent =
                buildString {
                    append(prompt)
                    if (!input.isNullOrBlank()) append("\n\nInput:\n").append(input)
                }
            val req =
                ChatReq(
                    model = model,
                    messages = listOf(Msg("user", userContent)),
                    temperature = temperature,
                    maxTokens = maxTokens,
                    stream = true,
                )
            val url = "$baseUrl/v1/chat/completions"

            val resp: HttpResponse =
                http.post(url) {
                    header(HttpHeaders.Authorization, "Bearer $apiKey")
                    contentType(ContentType.Application.Json)
                    setBody(req)
                }

            val ch = resp.bodyAsChannel()
            val buf = StringBuilder()

            while (!ch.isClosedForRead) {
                val packet = ch.readRemaining(max = 8192)
                val chunk = packet.readText()
                buf.append(chunk)

                // split by lines, handle "data: xxx"
                val lines = buf.splitToSequence("\n")
                // keep last partial line in buffer
                if (!buf.endsWith("\n")) {
                    val last = lines.lastOrNull() ?: ""
                    buf.clear().append(last)
                } else {
                    buf.clear()
                }

                for (line in lines) {
                    val t = line.trim()
                    if (!t.startsWith("data:")) continue
                    val payload = t.removePrefix("data:").trim()
                    if (payload == "[DONE]") {
                        close()
                        return@channelFlow
                    }
                    // parse chunk JSON
                    try {
                        val node = json.parseToJsonElement(payload).jsonObject
                        val choices = node["choices"]?.jsonArray
                        val delta =
                            choices
                                ?.get(0)
                                ?.jsonObject
                                ?.get("delta")
                                ?.jsonObject
                        val content = delta?.get("content")?.toString()?.trim('"')
                        if (!content.isNullOrEmpty()) trySend(content)
                    } catch (_: Throwable) {
                        // ignore
                    }
                }
            }
        }
}

// ---------- LM Studio (OpenAI compatible local server) ----------

class LmStudioClient(
    private val baseUrl: String = System.getenv("LMSTUDIO_BASE") ?: "http://localhost:8000",
) : LlmClient {
    private val http =
        HttpClient(CIO) {
            expectSuccess = false
            install(HttpTimeout) {
                requestTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS // no overall request timeout
                socketTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS // don't kill long-lived reads
                connectTimeoutMillis = 5_000 // ok to keep a sane connect timeout
            }
        }

    /**
     * Robustly read /v1/models and extract the "id" field from each element in "data".
     * No strict @Serializable classes, so small shape changes won't break parsing.
     */
    fun listModels(): List<String> =
        runBlocking {
            val resp: HttpResponse =
                http.get("$baseUrl/v1/models") {
                    accept(ContentType.Application.Json)
                }
            val text = resp.bodyAsText()
            if (resp.status.value !in 200..299) {
                throw IllegalStateException("LM Studio /v1/models HTTP ${resp.status.value}: $text")
            }
            try {
                val root = Json.parseToJsonElement(text).jsonObject
                val data = root["data"]?.jsonArray ?: return@runBlocking emptyList()
                data.mapNotNull { el ->
                    el.jsonObject["id"]?.jsonPrimitive?.content
                }
            } catch (e: Throwable) {
                throw IllegalStateException("Failed to parse /v1/models: $text", e)
            }
        }

    /**
     * Stream tokens using OpenAI-style /v1/chat/completions with stream=true.
     * LM Studio streams lines starting with "data: {...}" and ends with "data: [DONE]".
     */
    override fun stream(
        model: String,
        prompt: String,
        input: String?,
        temperature: Double?,
        maxTokens: Int?,
    ): Flow<String> =
        callbackFlow {
            val payload =
                buildJsonObject {
                    put("model", model)
                    put("stream", true)
                    putJsonArray("messages") {
                        addJsonObject {
                            put("role", "system")
                            put("content", "You are a helpful assistant.")
                        }
                        addJsonObject {
                            put("role", "user")
                            put("content", if (input.isNullOrBlank()) prompt else "$prompt\n\nInput:\n$input")
                        }
                    }
                    temperature?.let { put("temperature", it) }
                    maxTokens?.let { put("max_tokens", it) }
                }

            val call =
                http.post("$baseUrl/v1/chat/completions") {
                    contentType(ContentType.Application.Json)
                    accept(ContentType.Text.EventStream) // hint: SSE expected
                    header(HttpHeaders.CacheControl, "no-cache") // avoid proxy buffering
                    timeout {
                        // per-request guard
                        requestTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS
                        socketTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS
                    }
                    setBody(payload.toString())
                }

            if (call.status.value !in 200..299) {
                trySend("[provider error: HTTP ${call.status.value}]")
                close()
                return@callbackFlow
            }

            val channel = call.bodyAsChannel()
            try {
                while (isActive && !channel.isClosedForRead) {
                    val line = channel.readUTF8Line() ?: break
                    if (!line.startsWith("data:")) continue
                    val data = line.removePrefix("data:").trim()
                    if (data == "[DONE]") break
                    try {
                        val obj = Json.parseToJsonElement(data).jsonObject
                        val delta =
                            obj["choices"]
                                ?.jsonArray
                                ?.firstOrNull()
                                ?.jsonObject
                                ?.get("delta")
                                ?.jsonObject
                                ?.get("content")
                                ?.jsonPrimitive
                                ?.contentOrNull
                        if (!delta.isNullOrEmpty()) trySend(delta)
                    } catch (_: Throwable) {
                        // ignore bad chunk
                    }
                }
            } finally {
                channel.cancel()
                close()
            }
        }
}
