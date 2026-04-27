package com.molinobriganti.inventory.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("jwt_token")
        private val SERVER_URL_KEY = stringPreferencesKey("server_url")
        private val USERNAME_KEY = stringPreferencesKey("username")
        private val AVATAR_URL_KEY = stringPreferencesKey("avatar_url")
        private val SERVER_URL_HISTORY_KEY = stringSetPreferencesKey("server_url_history")
        private const val MAX_SERVER_URL_HISTORY = 10
    }

    val token: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[TOKEN_KEY]
    }

    val serverUrl: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[SERVER_URL_KEY]
    }

    val username: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USERNAME_KEY]
    }

    val avatarUrl: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[AVATAR_URL_KEY]
    }

    val serverUrlHistory: Flow<List<String>> = context.dataStore.data.map { prefs ->
        prefs[SERVER_URL_HISTORY_KEY]?.toList()?.sorted() ?: emptyList()
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
        }
    }

    suspend fun saveServerUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[SERVER_URL_KEY] = url
            // Add to history (capped at MAX_SERVER_URL_HISTORY)
            val current = prefs[SERVER_URL_HISTORY_KEY]?.toMutableSet() ?: mutableSetOf()
            if (url.isNotBlank()) {
                current.add(url)
                val trimmed = if (current.size > MAX_SERVER_URL_HISTORY) {
                    current.toList().takeLast(MAX_SERVER_URL_HISTORY).toSet()
                } else current
                prefs[SERVER_URL_HISTORY_KEY] = trimmed
            }
        }
    }

    suspend fun removeServerUrlFromHistory(url: String) {
        context.dataStore.edit { prefs ->
            val current = prefs[SERVER_URL_HISTORY_KEY]?.toMutableSet() ?: return@edit
            current.remove(url)
            prefs[SERVER_URL_HISTORY_KEY] = current
        }
    }

    suspend fun saveUsername(username: String) {
        context.dataStore.edit { prefs ->
            prefs[USERNAME_KEY] = username
        }
    }

    suspend fun saveAvatarUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[AVATAR_URL_KEY] = url
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }
}
