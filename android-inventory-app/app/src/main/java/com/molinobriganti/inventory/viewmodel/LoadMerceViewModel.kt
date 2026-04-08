package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import com.molinobriganti.inventory.data.model.Article
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

enum class LoadStep {
    SCAN_SHELF,
    SCAN_PRODUCT,
    ENTER_DETAILS,
    CONFIRM
}

data class LoadMerceState(
    val currentStep: LoadStep = LoadStep.SCAN_SHELF,
    val shelfBarcode: String = "",
    val productBarcode: String = "",
    val matchedArticle: Article? = null,
    val quantity: String = "",
    val batch: String = "",
    val expiry: String = "",
    val notes: String = "",
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class LoadMerceViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(LoadMerceState())
    val uiState: StateFlow<LoadMerceState> = _uiState.asStateFlow()

    fun onShelfScanned(barcode: String) {
        _uiState.update {
            it.copy(
                shelfBarcode = barcode,
                currentStep = LoadStep.SCAN_PRODUCT
            )
        }
    }

    fun onProductScanned(barcode: String) {
        _uiState.update {
            it.copy(
                productBarcode = barcode,
                currentStep = LoadStep.ENTER_DETAILS
            )
        }
    }

    fun onArticleMatched(article: Article?) {
        _uiState.update { it.copy(matchedArticle = article) }
    }

    fun onQuantityChanged(qty: String) {
        _uiState.update { it.copy(quantity = qty) }
    }

    fun onBatchChanged(batch: String) {
        _uiState.update { it.copy(batch = batch) }
    }

    fun onExpiryChanged(expiry: String) {
        _uiState.update { it.copy(expiry = expiry) }
    }

    fun onNotesChanged(notes: String) {
        _uiState.update { it.copy(notes = notes) }
    }

    fun goToConfirm() {
        _uiState.update { it.copy(currentStep = LoadStep.CONFIRM) }
    }

    fun goBack() {
        _uiState.update {
            val prevStep = when (it.currentStep) {
                LoadStep.SCAN_SHELF -> LoadStep.SCAN_SHELF
                LoadStep.SCAN_PRODUCT -> LoadStep.SCAN_SHELF
                LoadStep.ENTER_DETAILS -> LoadStep.SCAN_PRODUCT
                LoadStep.CONFIRM -> LoadStep.ENTER_DETAILS
            }
            it.copy(currentStep = prevStep)
        }
    }

    fun onSaveStarted() {
        _uiState.update { it.copy(isSaving = true) }
    }

    fun onSaveComplete() {
        _uiState.update { it.copy(isSaving = false, saveSuccess = true) }
    }

    fun onSaveError(error: String) {
        _uiState.update { it.copy(isSaving = false, error = error) }
    }

    fun reset() {
        _uiState.value = LoadMerceState()
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
