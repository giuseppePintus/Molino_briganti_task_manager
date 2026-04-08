package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.CreateArticleRequest
import com.molinobriganti.inventory.data.model.UpdateArticleRequest
import com.molinobriganti.inventory.data.repository.InventoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ArticleListState(
    val articles: List<Article> = emptyList(),
    val filteredArticles: List<Article> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val searchQuery: String = "",
    val selectedCategory: String? = null,
    val categories: List<String> = emptyList(),
    val operationSuccess: String? = null
)

@OptIn(FlowPreview::class)
@HiltViewModel
class ArticleViewModel @Inject constructor(
    private val repository: InventoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ArticleListState())
    val uiState: StateFlow<ArticleListState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")

    init {
        loadArticles()

        // Debounce search
        viewModelScope.launch {
            _searchQuery
                .debounce(300)
                .collectLatest { query ->
                    filterArticles(query, _uiState.value.selectedCategory)
                }
        }
    }

    fun loadArticles() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.getArticles()
                .onSuccess { articles ->
                    val categories = articles
                        .mapNotNull { it.category }
                        .distinct()
                        .sorted()
                    _uiState.update {
                        it.copy(
                            articles = articles,
                            filteredArticles = articles,
                            isLoading = false,
                            categories = categories
                        )
                    }
                    filterArticles(_uiState.value.searchQuery, _uiState.value.selectedCategory)
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        _searchQuery.value = query
    }

    fun onCategorySelected(category: String?) {
        _uiState.update { it.copy(selectedCategory = category) }
        filterArticles(_uiState.value.searchQuery, category)
    }

    fun updateStock(articleId: Int, newQuantity: Int, reason: String?) {
        viewModelScope.launch {
            repository.updateStock(articleId, newQuantity, reason)
                .onSuccess { loadArticles() }
                .onFailure { e ->
                    _uiState.update { it.copy(error = e.message) }
                }
        }
    }

    fun updateShelfPosition(articleId: Int, position: String) {
        viewModelScope.launch {
            repository.updateShelfPosition(articleId, position)
                .onSuccess { loadArticles() }
                .onFailure { e ->
                    _uiState.update { it.copy(error = e.message) }
                }
        }
    }

    fun assignToShelf(positionCode: String, articleId: Int, quantity: Int, batch: String?, expiry: String?) {
        viewModelScope.launch {
            repository.updateShelfPosition(articleId, positionCode)
                .onSuccess {
                    repository.updateStock(articleId, quantity, "Assegnazione scaffale $positionCode", batch, expiry)
                        .onSuccess { loadArticles() }
                        .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
                }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(operationSuccess = null) }
    }

    fun createArticle(code: String, name: String, description: String?, category: String?, unit: String, weightPerUnit: Float, barcode: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.createArticle(CreateArticleRequest(code, name, description, category, unit, weightPerUnit, barcode))
                .onSuccess { newArticle ->
                    val updated = _uiState.value.articles + newArticle
                    _uiState.update { it.copy(isLoading = false, articles = updated, filteredArticles = updated, operationSuccess = "Articolo creato") }
                    loadArticles() // refresh in background for consistency
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun updateArticle(id: Int, code: String, name: String, description: String?, category: String?, unit: String, weightPerUnit: Float, barcode: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.updateArticle(id, UpdateArticleRequest(code, name, description, category, unit, weightPerUnit, barcode))
                .onSuccess { updatedArticle ->
                    val updated = _uiState.value.articles.map { if (it.id == id) updatedArticle else it }
                    _uiState.update { it.copy(isLoading = false, articles = updated, filteredArticles = updated, operationSuccess = "Articolo aggiornato") }
                    loadArticles() // refresh in background for consistency
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun deleteArticle(id: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.deleteArticle(id)
                .onSuccess {
                    _uiState.update { it.copy(isLoading = false, operationSuccess = "Articolo eliminato") }
                    loadArticles()
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun filterArticles(query: String, category: String?) {
        val articles = _uiState.value.articles
        val filtered = articles.filter { article ->
            val matchesQuery = query.isBlank() ||
                article.name.contains(query, ignoreCase = true) ||
                article.code.contains(query, ignoreCase = true) ||
                (article.category?.contains(query, ignoreCase = true) == true)

            val matchesCategory = category == null ||
                article.category == category

            matchesQuery && matchesCategory
        }
        _uiState.update { it.copy(filteredArticles = filtered) }
    }
}
