package com.molinobriganti.inventory.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: UserInfo? = null
)

@Serializable
data class UserInfo(
    val id: Int,
    val username: String,
    val role: String? = null
)

@Serializable
data class StockUpdateRequest(
    val articleId: Int,
    val newQuantity: Int,
    val reason: String? = null,
    val batch: String? = null,
    val expiry: String? = null
)

@Serializable
data class ShelfPositionRequest(
    val articleId: Int,
    val shelfPosition: String
)

@Serializable
data class SetMinimumStockRequest(
    val articleId: Int,
    val minimumStock: Int,
    val criticalStock: Int? = null
)

@Serializable
data class CreateArticleRequest(
    val code: String,
    val name: String,
    val description: String? = null,
    val category: String? = null,
    val unit: String = "kg",
    val weightPerUnit: Float? = null,
    val barcode: String? = null
)

@Serializable
data class UpdateArticleRequest(
    val code: String? = null,
    val name: String? = null,
    val description: String? = null,
    val category: String? = null,
    val unit: String? = null,
    val weightPerUnit: Float? = null,
    val barcode: String? = null
)

@Serializable
data class CreateShelfPositionRequest(
    val code: String,
    val description: String? = null
)

@Serializable
data class UpdateShelfPositionRequest(
    val code: String? = null,
    val description: String? = null,
    val isActive: Boolean? = null
)

@Serializable
data class CreateTaskRequest(
    val title: String,
    val description: String? = null,
    val scheduledAt: String? = null,
    val assignedOperatorId: Int? = null,
    val priority: String = "HIGH",
    val estimatedMinutes: Int? = 30
)

@Serializable
data class CreateInternalOrderRequest(
    val articleId: Int? = null,
    val title: String,
    val description: String? = null,
    val scheduledAt: String? = null,
    val assignedOperatorId: Int? = null,
    val priority: String = "HIGH",
    val estimatedMinutes: Int? = 30
)

@Serializable
data class ArticleIdRequest(val articleId: Int)

@Serializable
data class CreateShelfEntryRequest(
    val articleId: Int,
    val positionCode: String,
    val quantity: Int = 0,
    val batch: String? = null,
    val expiry: String? = null,
    val notes: String? = null
)

@Serializable
data class UpdateShelfEntryRequest(
    val quantity: Int? = null,
    val batch: String? = null,
    val expiry: String? = null,
    val notes: String? = null,
    val positionCode: String? = null
)

@Serializable
data class ApiResponse<T>(
    val success: Boolean = true,
    val data: T? = null,
    val message: String? = null,
    val error: String? = null
)
