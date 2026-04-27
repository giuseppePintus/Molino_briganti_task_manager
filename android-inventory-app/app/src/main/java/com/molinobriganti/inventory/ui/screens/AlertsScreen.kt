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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.AlertItem
import com.molinobriganti.inventory.data.model.OperatorPublic
import com.molinobriganti.inventory.ui.theme.*
import com.molinobriganti.inventory.viewmodel.AlertsState
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    uiState: AlertsState,
    onRefresh: () -> Unit,
    onCreateOrder: (alert: AlertItem, quantity: Int, operatorId: Int?, scheduledAtIso: String, priority: String, extraNotes: String?) -> Unit,
    onDismissRestock: (articleId: Int) -> Unit = {},
    onUnsnooze: (articleId: Int) -> Unit = {},
    onClearToast: () -> Unit,
    onClearError: () -> Unit
) {
    var orderDialogFor by remember { mutableStateOf<AlertItem?>(null) }
    val snackHost = remember { SnackbarHostState() }

    LaunchedEffect(uiState.toast) {
        uiState.toast?.let {
            snackHost.showSnackbar(it)
            onClearToast()
        }
    }
    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackHost.showSnackbar("❌ $it")
            onClearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackHost) },
        topBar = {
            TopAppBar(
                title = {
                    androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                        Text("Avvisi Giacenza")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Banner restock: notifica che la merce è arrivata per articoli con ordine in corso
            if (uiState.restocks.isNotEmpty()) {
                uiState.restocks.forEach { rs ->
                    Surface(
                        color = Color(0xFF065F46),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("♻️", style = MaterialTheme.typography.titleLarge)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Restock effettuato: ${rs.name ?: rs.code ?: "Articolo"}",
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White
                                )
                                Text(
                                    "Era ${rs.snoozedAtStock} → ora ${rs.currentStock} (+${rs.delta})",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFFD1FAE5)
                                )
                            }
                            TextButton(onClick = { onDismissRestock(rs.articleId) }) {
                                Text("Ok", color = Color.White)
                            }
                        }
                    }
                }
            }
            when {
                uiState.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                uiState.alerts.isEmpty() -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
                    val active = uiState.alerts.filter { !it.snoozed }
                    val snoozed = uiState.alerts.filter { it.snoozed }
                    val critCount = active.count { it.level == "CRITICAL" }
                    val lowCount = active.count { it.level == "LOW" }

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
                                "${active.size} avvisi · 🚨 $critCount critici · ⚠️ $lowCount bassi",
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }

                    if (snoozed.isNotEmpty()) {
                        Surface(
                            color = Color(0xFF065F46),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                            shape = MaterialTheme.shapes.medium
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("📝", style = MaterialTheme.typography.titleLarge)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    "${snoozed.size} ordine/i interno/i in corso",
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White
                                )
                            }
                        }
                    }

                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(items = uiState.alerts, key = { it.articleId }) { alert ->
                            AlertCard(
                                alert = alert,
                                onCreateOrder = { orderDialogFor = alert },
                                onUnsnooze = { onUnsnooze(alert.articleId) }
                            )
                        }
                    }
                }
            }
        }
    }

    orderDialogFor?.let { alert ->
        CreateOrderDialog(
            alert = alert,
            operators = uiState.operators,
            onDismiss = { orderDialogFor = null },
            onConfirm = { qty, opId, iso, prio, notes ->
                onCreateOrder(alert, qty, opId, iso, prio, notes)
                orderDialogFor = null
            }
        )
    }
}

@Composable
private fun AlertCard(
    alert: AlertItem,
    onCreateOrder: () -> Unit,
    onUnsnooze: () -> Unit = {}
) {
    val isCritical = alert.level == "CRITICAL"
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when {
                alert.snoozed -> Color(0xFF065F46).copy(alpha = 0.15f)
                isCritical -> StockCritical.copy(alpha = 0.10f)
                else -> StockLow.copy(alpha = 0.10f)
            }
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isCritical) Icons.Default.ErrorOutline else Icons.Default.WarningAmber,
                    contentDescription = null,
                    tint = if (isCritical) StockCritical else StockLow,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = when {
                            alert.snoozed -> "✅ ORDINE IN CORSO"
                            isCritical -> "🚨 CRITICO"
                            else -> "⚠️ STOCK BASSO"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = when {
                            alert.snoozed -> Color(0xFF34D399)
                            isCritical -> StockCritical
                            else -> StockLow
                        },
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = alert.name ?: "Articolo #${alert.articleId}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${alert.code ?: ""}${alert.category?.let { " · $it" } ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Disp.: ${alert.availableStock} ${alert.unit ?: "kg"}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (alert.availableStock == 0) StockCritical else MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = "Avviso ${alert.minimumStock} · Crit. ${alert.criticalStock}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Fisica: ${alert.currentStock}" +
                        (if (alert.reservedStock > 0) "  ·  📅 Pren.: ${alert.reservedStock}" else ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (alert.reason == "RESERVED") {
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = "📅 per prenotazioni",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            if (alert.snoozed) {
                FilledTonalButton(
                    onClick = onUnsnooze,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("↻ Riapri")
                }
            } else {
                FilledTonalButton(
                    onClick = onCreateOrder,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Ordine interno")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateOrderDialog(
    alert: AlertItem,
    operators: List<OperatorPublic>,
    onDismiss: () -> Unit,
    onConfirm: (qty: Int, operatorId: Int?, scheduledAtIso: String, priority: String, notes: String?) -> Unit
) {
    val suggested = remember(alert) {
        val s = (alert.minimumStock * 2) - alert.availableStock
        if (s > 0) s else 10
    }
    var qtyText by remember { mutableStateOf(suggested.toString()) }
    var notes by remember { mutableStateOf("") }

    var selectedOperatorId by remember { mutableStateOf<Int?>(null) }
    var operatorMenuExpanded by remember { mutableStateOf(false) }

    val priorities = listOf("LOW" to "Bassa", "MEDIUM" to "Media", "HIGH" to "Alta", "URGENT" to "Urgente")
    var priority by remember { mutableStateOf("HIGH") }
    var prioMenuExpanded by remember { mutableStateOf(false) }

    val cal = remember {
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 9); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
    }
    var dateText by remember {
        val df = SimpleDateFormat("yyyy-MM-dd", Locale.ITALY)
        mutableStateOf(df.format(cal.time))
    }
    var timeText by remember { mutableStateOf("09:00") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("📝 Nuovo Ordine Interno") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = alert.name ?: alert.code ?: "Articolo",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Disp.: ${alert.availableStock} ${alert.unit ?: ""} · Soglia ${alert.minimumStock}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = qtyText,
                    onValueChange = { qtyText = it.filter { ch -> ch.isDigit() }.take(6) },
                    label = { Text("Quantità (colli)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                ExposedDropdownMenuBox(
                    expanded = operatorMenuExpanded,
                    onExpandedChange = { operatorMenuExpanded = !operatorMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = operators.firstOrNull { it.id == selectedOperatorId }?.username ?: "— Non assegnato —",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Operatore") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(operatorMenuExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = operatorMenuExpanded,
                        onDismissRequest = { operatorMenuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("— Non assegnato —") },
                            onClick = { selectedOperatorId = null; operatorMenuExpanded = false }
                        )
                        operators.forEach { op ->
                            DropdownMenuItem(
                                text = { Text(op.username) },
                                onClick = { selectedOperatorId = op.id; operatorMenuExpanded = false }
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = dateText,
                        onValueChange = { dateText = it },
                        label = { Text("Data") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = timeText,
                        onValueChange = { timeText = it },
                        label = { Text("Ora") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                ExposedDropdownMenuBox(
                    expanded = prioMenuExpanded,
                    onExpandedChange = { prioMenuExpanded = !prioMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = priorities.firstOrNull { it.first == priority }?.second ?: priority,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Priorità") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(prioMenuExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = prioMenuExpanded,
                        onDismissRequest = { prioMenuExpanded = false }
                    ) {
                        priorities.forEach { (k, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { priority = k; prioMenuExpanded = false }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Note (opzionale)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val qty = qtyText.toIntOrNull() ?: 0
                if (qty <= 0) return@TextButton
                val iso = parseLocalDateTimeToIso(dateText, timeText)
                onConfirm(qty, selectedOperatorId, iso, priority, notes.ifBlank { null })
            }) { Text("Crea Task") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } }
    )
}

private fun parseLocalDateTimeToIso(date: String, time: String): String {
    return try {
        val full = "$date ${if (time.length == 5) "$time:00" else time}"
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.ITALY)
        sdf.timeZone = TimeZone.getDefault()
        val parsed: Date = sdf.parse(full) ?: Date()
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        iso.timeZone = TimeZone.getTimeZone("UTC")
        iso.format(parsed)
    } catch (_: Exception) {
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        iso.timeZone = TimeZone.getTimeZone("UTC")
        iso.format(Date())
    }
}
