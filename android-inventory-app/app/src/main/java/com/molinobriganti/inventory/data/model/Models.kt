package com.molinobriganti.inventory.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Article(
    val id: Int,
    val code: String,
    val name: String,
    val description: String? = null,
    val category: String? = null,
    val unit: String = "kg",
    val weightPerUnit: Float = 1f,
    val barcode: String? = null,
    val inventory: InventoryData? = null,
    val shelfEntries: List<ShelfEntry>? = null
)

@Serializable
data class InventoryData(
    val id: Int,
    val articleId: Int,
    val currentStock: Int = 0,
    val minimumStock: Int = 0,
    val reserved: Int = 0,
    val position: String? = null,
    val shelfPosition: String? = null,
    val batch: String? = null,
    val expiry: String? = null,
    val notes: String? = null
)

@Serializable
data class StockAlert(
    val id: Int,
    val articleId: Int,
    val inventoryId: Int,
    val alertType: String,
    val currentStock: Int,
    val minimumStock: Int,
    val isResolved: Boolean = false,
    val createdAt: String,
    val article: Article? = null
)

@Serializable
data class StockMovement(
    val id: Int,
    val inventoryId: Int,
    val type: String,
    val quantity: Int,
    val reason: String? = null,
    val notes: String? = null,
    val createdAt: String
)

@Serializable
data class CompanySettings(
    val businessName: String = "Molino Briganti",
    val logoUrl: String? = null
)

@Serializable
data class ShelfPosition(
    val id: Int,
    val code: String,
    val description: String? = null,
    val isActive: Boolean = true
)

@Serializable
data class ShelfEntry(
    val id: Int,
    val articleId: Int,
    val positionCode: String,
    val quantity: Int = 0,
    val batch: String? = null,
    val expiry: String? = null,
    val notes: String? = null,
    val article: Article? = null
)

@Serializable
data class UploadResponse(
    val success: Boolean,
    val url: String? = null,
    val filename: String? = null,
    val message: String? = null
)
