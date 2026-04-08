package com.molinobriganti.inventory.data.repository

import com.molinobriganti.inventory.data.api.AuthApi
import com.molinobriganti.inventory.data.local.TokenManager
import com.molinobriganti.inventory.data.model.LoginRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager
) {
    suspend fun login(username: String, password: String): Result<Unit> = runCatching {
        val response = authApi.login(LoginRequest(username, password))
        if (response.isSuccessful) {
            val body = response.body() ?: throw Exception("Risposta vuota dal server")
            tokenManager.saveToken(body.token)
            tokenManager.saveUsername(username)
        } else {
            throw Exception(
                when (response.code()) {
                    401 -> "Credenziali non valide"
                    else -> "Errore server: ${response.code()}"
                }
            )
        }
    }

    suspend fun logout() {
        tokenManager.clearAll()
    }
}
