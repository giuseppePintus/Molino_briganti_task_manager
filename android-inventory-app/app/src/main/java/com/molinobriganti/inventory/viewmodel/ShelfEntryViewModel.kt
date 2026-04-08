package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.model.CreateShelfEntryRequest
import com.molinobriganti.inventory.data.model.ShelfEntry
import com.molinobriganti.inventory.data.model.UpdateShelfEntryRequest
import com.molinobriganti.inventory.data.repository.InventoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShelfEntriesState(
    val entries: List<ShelfEntry> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class ShelfEntryViewModel @Inject constructor(
    private val repository: InventoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShelfEntriesState())
    val uiState: StateFlow<ShelfEntriesState> = _uiState.asStateFlow()

    init { loadEntries() }

    fun loadEntries() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.getShelfEntries()
                .onSuccess { entries -> _uiState.update { it.copy(entries = entries, isLoading = false) } }
                .onFailure { e -> _uiState.update { it.copy(isLoading = false, error = e.message) } }
        }
    }

    fun createEntry(articleId: Int, positionCode: String, quantity: Int, batch: String?, expiry: String?, notes: String? = null) {
        viewModelScope.launch {
            repository.upsertShelfEntry(CreateShelfEntryRequest(articleId, positionCode, quantity, batch, expiry, notes))
                .onSuccess { loadEntries() }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun updateEntry(id: Int, quantity: Int, batch: String?, expiry: String?, notes: String? = null) {
        viewModelScope.launch {
            repository.updateShelfEntry(id, UpdateShelfEntryRequest(quantity, batch, expiry, notes))
                .onSuccess { loadEntries() }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun moveEntry(id: Int, newPositionCode: String) {
        viewModelScope.launch {
            repository.updateShelfEntry(id, UpdateShelfEntryRequest(positionCode = newPositionCode))
                .onSuccess { loadEntries() }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun deleteEntry(id: Int) {
        viewModelScope.launch {
            repository.deleteShelfEntry(id)
                .onSuccess { loadEntries() }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun clearError() { _uiState.update { it.copy(error = null) } }
}
