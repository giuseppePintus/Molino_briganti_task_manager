package com.molinobriganti.inventory.data.api

import com.molinobriganti.inventory.data.model.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface InventoryApi {

    // Articles
    @GET("api/inventory/articles")
    suspend fun getArticles(@Query("search") search: String? = null): Response<List<Article>>

    @GET("api/inventory/articles/{id}")
    suspend fun getArticle(@Path("id") id: Int): Response<Article>

    @POST("api/inventory/articles")
    suspend fun createArticle(@Body request: CreateArticleRequest): Response<ApiResponse<Article>>

    @PUT("api/inventory/articles/{id}")
    suspend fun updateArticle(@Path("id") id: Int, @Body request: UpdateArticleRequest): Response<ApiResponse<Article>>

    @DELETE("api/inventory/articles/{id}")
    suspend fun deleteArticle(@Path("id") id: Int): Response<Unit>

    // Categorie ordinate (sincronizzate col web)
    @GET("api/categories")
    suspend fun getCategories(): Response<List<CategoryDto>>

    // Stock
    @POST("api/inventory/stock/update")
    suspend fun updateStock(@Body request: StockUpdateRequest): Response<Map<String, String>>

    @POST("api/inventory/stock/set-minimum")
    suspend fun setMinimumStock(@Body request: SetMinimumStockRequest): Response<Map<String, String>>

    // Shelf position
    @POST("api/inventory/shelf-position")
    suspend fun updateShelfPosition(@Body request: ShelfPositionRequest): Response<Map<String, String>>

    // Alerts
    @GET("api/inventory/alerts")
    suspend fun getAlerts(): Response<List<StockAlert>>

    @POST("api/inventory/alerts/{alertId}/resolve")
    suspend fun resolveAlert(@Path("alertId") alertId: Int): Response<Map<String, String>>

    // Avvisi calcolati live (web parity)
    @GET("api/alerts")
    suspend fun getLiveAlerts(): Response<AlertsResponse>

    // Rimuove lo snooze (utile per dismissare un "restock effettuato")
    @POST("api/alerts/unsnooze")
    suspend fun unsnoozeAlert(@Body req: ArticleIdRequest): Response<Map<String, String>>

    // Operatori pubblici (per assegnazione task)
    @GET("api/auth/operators/public")
    suspend fun getPublicOperators(): Response<List<OperatorPublic>>

    @GET("api/auth/admins/public")
    suspend fun getPublicAdmins(): Response<List<OperatorPublic>>

    // Crea task (ordine interno)
    @POST("api/tasks")
    suspend fun createTask(@Body req: CreateTaskRequest): Response<Map<String, String>>

    // Crea ordine interno (qualunque utente autenticato; auto-snooze avviso)
    @POST("api/tasks/internal-order")
    suspend fun createInternalOrder(@Body req: CreateInternalOrderRequest): Response<Map<String, String>>

    // Batches
    @GET("api/inventory/batches")
    suspend fun getBatches(@Query("articleCode") articleCode: String): Response<List<InventoryData>>

    // CSV data
    @GET("api/inventory/master-csv/data")
    suspend fun getMasterCsvData(): Response<List<Article>>

    // Shelf positions (master list)
    @GET("api/inventory/shelf-positions")
    suspend fun getShelfPositions(): Response<List<ShelfPosition>>

    @POST("api/inventory/shelf-positions")
    suspend fun createShelfPosition(@Body request: CreateShelfPositionRequest): Response<ApiResponse<ShelfPosition>>

    @PUT("api/inventory/shelf-positions/{id}")
    suspend fun updateShelfPositionEntry(@Path("id") id: Int, @Body request: UpdateShelfPositionRequest): Response<ApiResponse<ShelfPosition>>

    @DELETE("api/inventory/shelf-positions/{id}")
    suspend fun deleteShelfPosition(@Path("id") id: Int): Response<Unit>

    // Shelf entries (many-to-many: article × position)
    @GET("api/inventory/shelf-entries")
    suspend fun getShelfEntries(
        @Query("positionCode") positionCode: String? = null,
        @Query("articleId") articleId: Int? = null
    ): Response<List<ShelfEntry>>

    @POST("api/inventory/shelf-entries")
    suspend fun upsertShelfEntry(@Body request: CreateShelfEntryRequest): Response<ApiResponse<ShelfEntry>>

    @PUT("api/inventory/shelf-entries/{id}")
    suspend fun updateShelfEntry(@Path("id") id: Int, @Body request: UpdateShelfEntryRequest): Response<ApiResponse<ShelfEntry>>

    @DELETE("api/inventory/shelf-entries/{id}")
    suspend fun deleteShelfEntry(@Path("id") id: Int): Response<Unit>

    // Company settings
    @GET("api/settings/company")
    suspend fun getCompanySettings(): Response<CompanySettings>

    // Avatar upload
    @Multipart
    @POST("api/upload/avatar")
    suspend fun uploadAvatar(@Part avatar: MultipartBody.Part): Response<UploadResponse>
}
