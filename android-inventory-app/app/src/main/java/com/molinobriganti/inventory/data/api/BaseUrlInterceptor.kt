package com.molinobriganti.inventory.data.api

import com.molinobriganti.inventory.BuildConfig
import com.molinobriganti.inventory.data.local.TokenManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class BaseUrlInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val savedUrl = runBlocking { tokenManager.serverUrl.first() }
        val rawUrl = if (!savedUrl.isNullOrBlank()) savedUrl.trimEnd('/') else BuildConfig.BASE_URL
        val baseUrl = if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) "http://$rawUrl" else rawUrl
        val parsedBase = baseUrl.toHttpUrl()

        val originalUrl = chain.request().url
        val newUrl = originalUrl.newBuilder()
            .scheme(parsedBase.scheme)
            .host(parsedBase.host)
            .port(parsedBase.port)
            .build()

        return chain.proceed(chain.request().newBuilder().url(newUrl).build())
    }
}
