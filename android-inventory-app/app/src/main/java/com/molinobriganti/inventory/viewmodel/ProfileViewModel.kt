package com.molinobriganti.inventory.viewmodel

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.local.TokenManager
import com.molinobriganti.inventory.data.repository.InventoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val inventoryRepository: InventoryRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _avatarUrl = MutableStateFlow<String?>(null)
    val avatarUrl: StateFlow<String?> = _avatarUrl.asStateFlow()

    private val _uploadError = MutableStateFlow<String?>(null)
    val uploadError: StateFlow<String?> = _uploadError.asStateFlow()

    init {
        viewModelScope.launch {
            tokenManager.avatarUrl.collect { url ->
                _avatarUrl.value = url
            }
        }
    }

    fun uploadAvatar(uri: Uri, context: Context) {
        viewModelScope.launch {
            val part = withContext(Dispatchers.IO) {
                val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext null
                val bytes = inputStream.readBytes()
                inputStream.close()
                val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                val ext = mimeType.substringAfter('/', "jpg")
                val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
                MultipartBody.Part.createFormData("avatar", "avatar.$ext", requestBody)
            } ?: return@launch
            inventoryRepository.uploadAvatar(part)
                .onSuccess { url ->
                    tokenManager.saveAvatarUrl(url)
                    _avatarUrl.value = url
                }
                .onFailure { e ->
                    _uploadError.value = "Errore caricamento foto: ${e.message}"
                }
        }
    }

    fun clearError() {
        _uploadError.value = null
    }
}
