package com.molinobriganti.inventory.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.StockAlert
import com.molinobriganti.inventory.ui.theme.*
import com.molinobriganti.inventory.viewmodel.AlertsState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    uiState: AlertsState,
    onRefresh: () -> Unit,
    onResolveAlert: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Avvisi Stock") },
            actions = {
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, contentDescription = "Aggiorna")
                }
            }
        )

        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.error != null -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = uiState.error,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onRefresh) { Text("Riprova") }
                    }
                }
            }

            uiState.alerts.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = StockOk
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Nessun avviso attivo",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "Tutti gli articoli hanno stock sufficiente",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            else -> {
                // Alert count badge
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "${uiState.alerts.size} avvis${if (uiState.alerts.size == 1) "o" else "i"} attiv${if (uiState.alerts.size == 1) "o" else "i"}",
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }

                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(
                        items = uiState.alerts,
                        key = { it.id }
                    ) { alert ->
                        AlertCard(
                            alert = alert,
                            onResolve = { onResolveAlert(alert.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AlertCard(
    alert: StockAlert,
    onResolve: () -> Unit
) {
    val isCritical = alert.alertType == "CRITICAL"

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isCritical)
                StockCritical.copy(alpha = 0.08f)
            else
                StockLow.copy(alpha = 0.08f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Alert icon
            Icon(
                if (isCritical) Icons.Default.ErrorOutline else Icons.Default.WarningAmber,
                contentDescription = null,
                tint = if (isCritical) StockCritical else StockLow,
                modifier = Modifier.size(40.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = alert.article?.name ?: "Articolo #${alert.articleId}",
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    text = if (isCritical) "CRITICO" else "STOCK BASSO",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isCritical) StockCritical else StockLow,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Attuale: ${alert.currentStock} | Minimo: ${alert.minimumStock}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            FilledTonalButton(
                onClick = onResolve,
                contentPadding = PaddingValues(horizontal = 12.dp)
            ) {
                Text("Risolvi", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
