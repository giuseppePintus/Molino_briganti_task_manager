package com.molinobriganti.inventory.data.api

import com.molinobriganti.inventory.data.local.TokenManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenManager.token.first() }
        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        val response = chain.proceed(request)
        // Logout automatico SOLO se il server segnala esplicitamente un token
        // non valido/scaduto. NON sloggare per 403 di "permesso insufficiente"
        // (es. "Only master can ...").
        if (!token.isNullOrBlank() && (response.code == 401 || response.code == 403)) {
            val path = request.url.encodedPath
            if (!path.endsWith("/api/auth/login")) {
                // Peek body senza consumarlo per il chiamante
                val peek = try {
                    response.peekBody(2048).string()
                } catch (_: Exception) { "" }
                val isTokenError = response.code == 401 ||
                    peek.contains("Failed to authenticate token", ignoreCase = true) ||
                    peek.contains("No token provided", ignoreCase = true) ||
                    peek.contains("jwt expired", ignoreCase = true) ||
                    peek.contains("invalid token", ignoreCase = true)
                if (isTokenError) {
                    runBlocking { tokenManager.clearAll() }
                }
            }
        }
        return response
    }
}
