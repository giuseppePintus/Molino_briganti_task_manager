package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.model.AlertItem
import com.molinobriganti.inventory.data.model.CreateTaskRequest
import com.molinobriganti.inventory.data.model.CreateInternalOrderRequest
import com.molinobriganti.inventory.data.model.OperatorPublic
import com.molinobriganti.inventory.data.model.RestockItem
import com.molinobriganti.inventory.data.repository.InventoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AlertsState(
    val alerts: List<AlertItem> = emptyList(),
    val restocks: List<RestockItem> = emptyList(),
    val operators: List<OperatorPublic> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val toast: String? = null
)

@HiltViewModel
class AlertViewModel @Inject constructor(
    private val repository: InventoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AlertsState())
    val uiState: StateFlow<AlertsState> = _uiState.asStateFlow()

    init {
        loadAlerts()
        loadOperators()
    }

    fun loadAlerts() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.getLiveAlertsFull()
                .onSuccess { resp ->
                    _uiState.update { it.copy(alerts = resp.alerts, restocks = resp.restocks, isLoading = false) }
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun dismissRestock(articleId: Int) {
        viewModelScope.launch {
            try { repository.unsnoozeAlert(articleId) } catch (_: Exception) {}
            loadAlerts()
        }
    }

    fun unsnoozeAlert(articleId: Int) {
        viewModelScope.launch {
            repository.unsnoozeAlert(articleId)
                .onSuccess {
                    _uiState.update { it.copy(toast = "↻ Ordine riaperto") }
                    loadAlerts()
                }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    private fun loadOperators() {
        viewModelScope.launch {
            repository.getPublicOperators()
                .onSuccess { ops -> _uiState.update { it.copy(operators = ops) } }
        }
    }

    fun createOrderTask(
        alert: AlertItem,
        quantity: Int,
        operatorId: Int?,
        scheduledAtIso: String,
        priority: String,
        extraNotes: String?
    ) {
        viewModelScope.launch {
            val title = "🛒 Ordine interno: ${alert.name ?: alert.code} × $quantity colli"
            val description = buildString {
                append("Articolo: ${alert.name ?: "-"}\n")
                append("Codice: ${alert.code ?: "-"}\n")
                append("Categoria: ${alert.category ?: "-"}\n")
                append("Quantità da riordinare: $quantity colli\n")
                append("Giacenza attuale: ${alert.currentStock} colli\n")
                append("Soglia avviso: ${alert.minimumStock} · Soglia critica: ${alert.criticalStock}")
                if (!extraNotes.isNullOrBlank()) append("\n\nNote: ${extraNotes.trim()}")
            }
            repository.createInternalOrder(
                CreateInternalOrderRequest(
                    articleId = alert.articleId,
                    title = title,
                    description = description,
                    scheduledAt = scheduledAtIso,
                    assignedOperatorId = operatorId,
                    priority = priority,
                    estimatedMinutes = 30
                )
            ).onSuccess {
                _uiState.update { it.copy(toast = "✅ Task ordine interno creato") }
                loadAlerts()
            }.onFailure { e ->
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    fun clearToast() = _uiState.update { it.copy(toast = null) }
    fun clearError() = _uiState.update { it.copy(error = null) }
}
