package com.molinobriganti.inventory.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfEntry
import com.molinobriganti.inventory.data.model.ShelfPosition
import com.molinobriganti.inventory.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleDetailScreen(
    article: Article,
    shelfPositions: List<ShelfPosition>,
    shelfEntries: List<ShelfEntry>,
    onBack: () -> Unit,
    onUpdateStock: (Int, Int, String?) -> Unit,
    onUpdatePosition: (Int, String) -> Unit,
    onCreateEntry: (positionCode: String, quantity: Int, batch: String?, expiry: String?, notes: String?) -> Unit,
    onUpdateEntry: (id: Int, quantity: Int, batch: String?, expiry: String?, notes: String?) -> Unit,
    onDeleteEntry: (id: Int) -> Unit,
    onEdit: (Article) -> Unit,
    onDelete: (Int) -> Unit
) {
    val inventory = article.inventory
    val totalStock = shelfEntries.sumOf { it.quantity }
    val totalKg = totalStock * article.weightPerUnit
    val kgFormatted = if (totalKg % 1 == 0f) totalKg.toInt().toString() else "%.1f".format(totalKg)
    var showPositionDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showShelfEntryDialog by remember { mutableStateOf(false) }
    var entryToEdit by remember { mutableStateOf<ShelfEntry?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                    Text(article.name, maxLines = 1)
                }
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                }
            },
            actions = {
                IconButton(onClick = { onEdit(article) }) {
                    Icon(Icons.Default.Edit, contentDescription = "Modifica")
                }
                IconButton(onClick = { showDeleteDialog = true }) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Elimina",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = article.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Codice: ${article.code}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    if (article.category != null) {
                        Text(
                            text = "Categoria: ${article.category}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    Text(
                        text = "Unità: ${article.unit}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Stock card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Giacenza",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        StockInfoItem(
                            label = "Colli",
                            value = "$totalStock",
                            color = when {
                                totalStock <= 0 -> StockCritical
                                inventory != null && inventory.minimumStock > 0 &&
                                    totalStock <= inventory.minimumStock -> StockLow
                                else -> StockOk
                            }
                        )
                        StockInfoItem(
                            label = "Kg totali",
                            value = kgFormatted,
                            color = MaterialTheme.colorScheme.primary
                        )
                        StockInfoItem(
                            label = "Minimo",
                            value = "${inventory?.minimumStock ?: 0}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        StockInfoItem(
                            label = "Riservato",
                            value = "${inventory?.reserved ?: 0}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }


                }
            }

            // Shelf entries card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Posizioni Scaffale",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                entryToEdit = null
                                showShelfEntryDialog = true
                            }
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Aggiungi posizione")
                        }
                    }

                    if (shelfEntries.isEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Nessuna posizione assegnata",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        shelfEntries.forEachIndexed { index, entry ->
                            if (index > 0) HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                            else Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                // Position badge
                                Surface(
                                    color = MaterialTheme.colorScheme.primaryContainer,
                                    shape = RoundedCornerShape(6.dp),
                                    modifier = Modifier.padding(top = 2.dp)
                                ) {
                                    Text(
                                        text = entry.positionCode,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(10.dp))

                                // Details
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Qty: ${entry.quantity}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    if (entry.batch != null) {
                                        Text(
                                            text = "Lotto: ${entry.batch}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    if (entry.expiry != null) {
                                        Text(
                                            text = "Scad: ${entry.expiry}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    if (entry.notes != null) {
                                        Text(
                                            text = entry.notes,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                // Edit button
                                IconButton(
                                    onClick = {
                                        entryToEdit = entry
                                        showShelfEntryDialog = true
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "Modifica", modifier = Modifier.size(18.dp))
                                }
                                // Delete button
                                IconButton(
                                    onClick = { onDeleteEntry(entry.id) },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Elimina",
                                        tint = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Batch & Expiry
            if (inventory?.batch != null || inventory?.expiry != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Lotto e Scadenza",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        if (inventory.batch != null) {
                            Text("Lotto: ${inventory.batch}")
                        }
                        if (inventory.expiry != null) {
                            Text("Scadenza: ${inventory.expiry}")
                        }
                    }
                }
            }

            // Notes
            if (inventory?.notes != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Note",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(inventory.notes)
                    }
                }
            }
        }
    }

    // Position dialog
    if (showPositionDialog) {
        PositionUpdateDialog(
            currentPosition = inventory?.shelfPosition ?: "",
            shelfPositions = shelfPositions,
            onDismiss = { showPositionDialog = false },
            onConfirm = { position ->
                onUpdatePosition(article.id, position)
                showPositionDialog = false
            }
        )
    }

    // Shelf entry create/edit dialog
    if (showShelfEntryDialog) {
        ArticleShelfEntryDialog(
            entryToEdit = entryToEdit,
            shelfPositions = shelfPositions,
            onDismiss = { showShelfEntryDialog = false },
            onSave = { positionCode, quantity, batch, expiry, notes ->
                val entry = entryToEdit
                if (entry == null) {
                    onCreateEntry(positionCode, quantity, batch, expiry, notes)
                } else {
                    onUpdateEntry(entry.id, quantity, batch, expiry, notes)
                }
                showShelfEntryDialog = false
            }
        )
    }

    // Delete confirmation dialog
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Eliminare articolo?") },
            text = {
                Text("Sei sicuro di voler eliminare \"${article.name}\" (${article.code})? Questa azione non può essere annullata.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        onDelete(article.id)
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Elimina")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Annulla")
                }
            }
        )
    }
}

@Composable
fun StockInfoItem(
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun StockUpdateDialog(
    currentStock: Int,
    unit: String,
    onDismiss: () -> Unit,
    onConfirm: (Int, String?) -> Unit
) {
    var newQuantity by remember { mutableStateOf(currentStock.toString()) }
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Aggiorna Giacenza") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Giacenza attuale: $currentStock $unit")
                OutlinedTextField(
                    value = newQuantity,
                    onValueChange = { newQuantity = it.filter { c -> c.isDigit() } },
                    label = { Text("Nuova quantità ($unit)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Motivo (opzionale)") },
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = newQuantity.toIntOrNull() ?: currentStock
                    onConfirm(qty, reason.ifBlank { null })
                }
            ) {
                Text("Salva")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annulla")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PositionUpdateDialog(
    currentPosition: String,
    shelfPositions: List<ShelfPosition>,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var position by remember { mutableStateOf(currentPosition) }
    var expanded by remember { mutableStateOf(false) }
    val filteredPositions = remember(position, shelfPositions) {
        if (position.isBlank()) {
            shelfPositions.filter { it.isActive }
        } else {
            shelfPositions.filter { pos ->
                pos.isActive && (
                    pos.code.contains(position, ignoreCase = true) ||
                    (pos.description?.contains(position, ignoreCase = true) == true)
                )
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Modifica Posizione") },
        text = {
            Column {
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it }
                ) {
                    OutlinedTextField(
                        value = position,
                        onValueChange = {
                            position = it
                            expanded = true
                        },
                        label = { Text("Posizione scaffale") },
                        placeholder = { Text("es. A1.1") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded && filteredPositions.isNotEmpty(),
                        onDismissRequest = { expanded = false }
                    ) {
                        filteredPositions.take(10).forEach { pos ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(pos.code, fontWeight = FontWeight.Medium)
                                        if (pos.description != null) {
                                            Text(
                                                pos.description,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                },
                                onClick = {
                                    position = pos.code
                                    expanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(position) },
                enabled = position.isNotBlank()
            ) {
                Text("Salva")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annulla")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleShelfEntryDialog(
    entryToEdit: ShelfEntry?,
    shelfPositions: List<ShelfPosition>,
    onDismiss: () -> Unit,
    onSave: (positionCode: String, quantity: Int, batch: String?, expiry: String?, notes: String?) -> Unit
) {
    val isEdit = entryToEdit != null
    var positionCode by remember { mutableStateOf(entryToEdit?.positionCode ?: "") }
    var expanded by remember { mutableStateOf(false) }
    var quantityInput by remember { mutableStateOf((entryToEdit?.quantity ?: 0).toString()) }
    var batchInput by remember { mutableStateOf(entryToEdit?.batch ?: "") }
    var expiryInput by remember { mutableStateOf(entryToEdit?.expiry ?: "") }
    var notesInput by remember { mutableStateOf(entryToEdit?.notes ?: "") }

    val filteredPositions = remember(positionCode, shelfPositions) {
        if (positionCode.isBlank()) shelfPositions.filter { it.isActive }
        else shelfPositions.filter { pos ->
            pos.isActive && (
                pos.code.contains(positionCode, ignoreCase = true) ||
                (pos.description?.contains(positionCode, ignoreCase = true) == true)
            )
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isEdit) "Modifica posizione" else "Aggiungi posizione") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (isEdit) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = entryToEdit!!.positionCode,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                } else {
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = it }
                    ) {
                        OutlinedTextField(
                            value = positionCode,
                            onValueChange = {
                                positionCode = it
                                expanded = true
                            },
                            label = { Text("Posizione scaffale") },
                            placeholder = { Text("es. A1.1") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = expanded && filteredPositions.isNotEmpty(),
                            onDismissRequest = { expanded = false }
                        ) {
                            filteredPositions.take(10).forEach { pos ->
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(pos.code, fontWeight = FontWeight.Medium)
                                            if (pos.description != null) {
                                                Text(
                                                    pos.description,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }
                                    },
                                    onClick = {
                                        positionCode = pos.code
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = quantityInput,
                    onValueChange = { quantityInput = it.filter { c -> c.isDigit() } },
                    label = { Text("Quantità") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = batchInput,
                        onValueChange = { batchInput = it },
                        label = { Text("Lotto") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = expiryInput,
                        onValueChange = { expiryInput = it },
                        label = { Text("Scad.") },
                        placeholder = { Text("MM/AAAA") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = notesInput,
                    onValueChange = { notesInput = it },
                    label = { Text("Note") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        positionCode,
                        quantityInput.toIntOrNull() ?: 0,
                        batchInput.trim().takeIf { it.isNotBlank() },
                        expiryInput.trim().takeIf { it.isNotBlank() },
                        notesInput.trim().takeIf { it.isNotBlank() }
                    )
                },
                enabled = positionCode.isNotBlank()
            ) {
                Text("Salva")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annulla") }
        }
    )
}
