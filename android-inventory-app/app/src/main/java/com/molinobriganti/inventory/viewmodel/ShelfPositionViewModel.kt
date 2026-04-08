package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.model.CreateShelfPositionRequest
import com.molinobriganti.inventory.data.model.ShelfPosition
import com.molinobriganti.inventory.data.repository.InventoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShelfPositionState(
    val positions: List<ShelfPosition> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val operationSuccess: String? = null
)

@HiltViewModel
class ShelfPositionViewModel @Inject constructor(
    private val repository: InventoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShelfPositionState())
    val uiState: StateFlow<ShelfPositionState> = _uiState.asStateFlow()

    init {
        loadPositions()
    }

    fun loadPositions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.getShelfPositions()
                .onSuccess { positions ->
                    _uiState.update {
                        it.copy(positions = positions, isLoading = false)
                    }
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun createPosition(code: String, description: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.createShelfPosition(CreateShelfPositionRequest(code, description))
                .onSuccess {
                    _uiState.update { it.copy(isLoading = false, operationSuccess = "Posizione creata") }
                    loadPositions()
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun deletePosition(id: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            repository.deleteShelfPosition(id)
                .onSuccess {
                    _uiState.update { it.copy(isLoading = false, operationSuccess = "Posizione eliminata") }
                    loadPositions()
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(operationSuccess = null) }
    }
}
