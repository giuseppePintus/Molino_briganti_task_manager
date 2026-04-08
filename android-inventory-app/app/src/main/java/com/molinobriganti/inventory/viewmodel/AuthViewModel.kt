package com.molinobriganti.inventory.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.molinobriganti.inventory.data.local.TokenManager
import com.molinobriganti.inventory.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoggedIn: Boolean = false,
    val isLoading: Boolean = false,
    val username: String = "",
    val error: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            tokenManager.token.collect { token ->
                val username = tokenManager.username.first() ?: ""
                _uiState.update {
                    it.copy(isLoggedIn = !token.isNullOrBlank(), username = username)
                }
            }
        }
    }

    fun login(serverUrl: String, username: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            if (serverUrl.isNotBlank()) {
                tokenManager.saveServerUrl(serverUrl.trimEnd('/'))
            }
            authRepository.login(username, password)
                .onSuccess {
                    _uiState.update { it.copy(isLoading = false, isLoggedIn = true, username = username) }
                }
                .onFailure { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun updateServerUrl(url: String) {
        viewModelScope.launch {
            tokenManager.saveServerUrl(url.trimEnd('/'))
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update { AuthUiState() }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
