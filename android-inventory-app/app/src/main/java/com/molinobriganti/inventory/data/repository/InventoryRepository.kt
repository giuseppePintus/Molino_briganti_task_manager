package com.molinobriganti.inventory.data.repository

import com.molinobriganti.inventory.data.api.InventoryApi
import com.molinobriganti.inventory.data.model.*
import okhttp3.MultipartBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InventoryRepository @Inject constructor(
    private val api: InventoryApi
) {
    suspend fun getArticles(search: String? = null): Result<List<Article>> = runCatching {
        val response = api.getArticles(search)
        if (response.isSuccessful) {
            response.body() ?: emptyList()
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun getArticle(id: Int): Result<Article> = runCatching {
        val response = api.getArticle(id)
        if (response.isSuccessful) {
            response.body() ?: throw Exception("Articolo non trovato")
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun createArticle(request: CreateArticleRequest): Result<Article> = runCatching {
        val response = api.createArticle(request)
        if (response.isSuccessful) {
            response.body()?.data ?: throw Exception("Errore nella creazione")
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun updateArticle(id: Int, request: UpdateArticleRequest): Result<Article> = runCatching {
        val response = api.updateArticle(id, request)
        if (response.isSuccessful) {
            response.body()?.data ?: throw Exception("Errore nell'aggiornamento")
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun deleteArticle(id: Int): Result<Unit> = runCatching {
        val response = api.deleteArticle(id)
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun updateStock(articleId: Int, newQuantity: Int, reason: String?, batch: String? = null, expiry: String? = null): Result<Unit> = runCatching {
        val response = api.updateStock(StockUpdateRequest(articleId, newQuantity, reason, batch, expiry))
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun setMinimumStock(articleId: Int, minimumStock: Int): Result<Unit> = runCatching {
        val response = api.setMinimumStock(SetMinimumStockRequest(articleId, minimumStock))
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun updateShelfPosition(articleId: Int, shelfPosition: String): Result<Unit> = runCatching {
        val response = api.updateShelfPosition(ShelfPositionRequest(articleId, shelfPosition))
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun getAlerts(): Result<List<StockAlert>> = runCatching {
        val response = api.getAlerts()
        if (response.isSuccessful) {
            response.body() ?: emptyList()
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun resolveAlert(alertId: Int): Result<Unit> = runCatching {
        val response = api.resolveAlert(alertId)
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun getShelfPositions(): Result<List<ShelfPosition>> = runCatching {
        val response = api.getShelfPositions()
        if (response.isSuccessful) {
            response.body() ?: emptyList()
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun createShelfPosition(request: CreateShelfPositionRequest): Result<ShelfPosition> = runCatching {
        val response = api.createShelfPosition(request)
        if (response.isSuccessful) {
            response.body()?.data ?: throw Exception("Errore nella creazione")
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun deleteShelfPosition(id: Int): Result<Unit> = runCatching {
        val response = api.deleteShelfPosition(id)
        if (!response.isSuccessful) {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun getCompanySettings(): Result<CompanySettings> = runCatching {
        val response = api.getCompanySettings()
        if (response.isSuccessful) {
            response.body() ?: CompanySettings()
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }

    suspend fun getShelfEntries(positionCode: String? = null, articleId: Int? = null): Result<List<ShelfEntry>> = runCatching {
        val response = api.getShelfEntries(positionCode, articleId)
        if (response.isSuccessful) response.body() ?: emptyList()
        else throw Exception("Errore ${response.code()}: ${response.message()}")
    }

    suspend fun upsertShelfEntry(request: CreateShelfEntryRequest): Result<ShelfEntry> = runCatching {
        val response = api.upsertShelfEntry(request)
        if (response.isSuccessful) response.body()?.data ?: throw Exception("Errore nella creazione")
        else throw Exception("Errore ${response.code()}: ${response.message()}")
    }

    suspend fun updateShelfEntry(id: Int, request: UpdateShelfEntryRequest): Result<ShelfEntry> = runCatching {
        val response = api.updateShelfEntry(id, request)
        if (response.isSuccessful) response.body()?.data ?: throw Exception("Errore aggiornamento")
        else throw Exception("Errore ${response.code()}: ${response.message()}")
    }

    suspend fun deleteShelfEntry(id: Int): Result<Unit> = runCatching {
        val response = api.deleteShelfEntry(id)
        if (!response.isSuccessful) throw Exception("Errore ${response.code()}: ${response.message()}")
    }

    suspend fun uploadAvatar(part: MultipartBody.Part): Result<String> = runCatching {
        val response = api.uploadAvatar(part)
        if (response.isSuccessful) {
            response.body()?.url ?: throw Exception("URL non disponibile")
        } else {
            throw Exception("Errore ${response.code()}: ${response.message()}")
        }
    }
}
