package com.molinobriganti.inventory.data.api

import com.molinobriganti.inventory.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
}
