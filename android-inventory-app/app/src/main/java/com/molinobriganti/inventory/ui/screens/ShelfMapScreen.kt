package com.molinobriganti.inventory.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfEntry
import com.molinobriganti.inventory.data.model.ShelfPosition
import com.molinobriganti.inventory.util.NaturalOrderComparator

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShelfMapScreen(
    shelfPositions: List<ShelfPosition>,
    articles: List<Article>,
    shelfEntries: List<ShelfEntry>,
    isLoading: Boolean,
    onBack: () -> Unit,
    onPrint: () -> Unit = {},
    onCreateEntry: (articleId: Int, positionCode: String, quantity: Int, batch: String?, expiry: String?) -> Unit,
    onUpdateEntry: (id: Int, quantity: Int, batch: String?, expiry: String?) -> Unit,
    onDeleteEntry: (id: Int) -> Unit,
    onMoveEntry: (id: Int, newPositionCode: String) -> Unit = { _, _ -> },
    onCopyEntry: (articleId: Int, positionCode: String, quantity: Int, batch: String?, expiry: String?) -> Unit = { _, _, _, _, _ -> }
) {
    val grouped = remember(shelfPositions) {
        shelfPositions.sortedWith(compareBy(NaturalOrderComparator) { it.code })
            .groupBy { it.code.first().toString() }
    }
    val expandedSectors = remember {
        mutableStateMapOf<String, Boolean>().also { map ->
            grouped.keys.forEach { map[it] = false }
        }
    }

    var selectedPosition by remember { mutableStateOf<ShelfPosition?>(null) }
    var showEntryForm by remember { mutableStateOf(false) }
    var entryToEdit by remember { mutableStateOf<ShelfEntry?>(null) }
    var pendingScannedValue by remember { mutableStateOf<String?>(null) }
    var showScanner by remember { mutableStateOf(false) }

    if (showScanner) {
        BarcodeScannerScreen(
            title = "Scansiona Prodotto",
            instruction = "Inquadra codice a barre o QR del prodotto",
            onBarcodeScanned = { scanned ->
                pendingScannedValue = scanned
                showScanner = false
                showEntryForm = true
                entryToEdit = null
            },
            onClose = {
                showScanner = false
                showEntryForm = true
            }
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                    Text("Mappa Scaffali")
                }
            },
            actions = {
                IconButton(onClick = onPrint) {
                    Icon(Icons.Default.Print, contentDescription = "Stampa inventario")
                }
            }
        )

        if (isLoading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            grouped.forEach { (sector, positions) ->
                item(key = "header_$sector") {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                expandedSectors[sector] = !(expandedSectors[sector] ?: false)
                            },
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.ViewModule,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Settore $sector",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                "${positions.count { pos -> shelfEntries.any { it.positionCode == pos.code } }}/${positions.size} occupati",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(
                                if (expandedSectors[sector] == true) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }

                item(key = "list_$sector") {
                    AnimatedVisibility(visible = expandedSectors[sector] == true) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            positions.forEach { pos ->
                                val entriesAtPos = shelfEntries.filter { it.positionCode == pos.code }
                                ShelfPositionRow(
                                    position = pos,
                                    entries = entriesAtPos,
                                    articles = articles,
                                    onClick = {
                                        selectedPosition = pos
                                        showEntryForm = false
                                        entryToEdit = null
                                        pendingScannedValue = null
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Dialogs
    selectedPosition?.let { pos ->
        val entriesAtPos = shelfEntries.filter { it.positionCode == pos.code }
        if (!showEntryForm) {
            ShelfPositionEntriesDialog(
                position = pos,
                entries = entriesAtPos,
                articles = articles,
                shelfPositions = shelfPositions,
                onAddNew = {
                    entryToEdit = null
                    pendingScannedValue = null
                    showEntryForm = true
                },
                onEditEntry = { entry ->
                    entryToEdit = entry
                    showEntryForm = true
                },
                onDeleteEntry = onDeleteEntry,
                onMoveEntry = onMoveEntry,
                onCopyEntry = onCopyEntry,
                onDismiss = { selectedPosition = null }
            )
        } else {
            ShelfEntryEditDialog(
                position = pos,
                entryToEdit = entryToEdit,
                articles = articles,
                initialScannedValue = pendingScannedValue,
                onScanRequest = {
                    showScanner = true
                    showEntryForm = false
                },
                onSave = { articleId, quantity, batch, expiry ->
                    if (entryToEdit != null) {
                        onUpdateEntry(entryToEdit!!.id, quantity, batch, expiry)
                    } else {
                        onCreateEntry(articleId, pos.code, quantity, batch, expiry)
                    }
                    pendingScannedValue = null
                    showEntryForm = false
                    entryToEdit = null
                    selectedPosition = null
                },
                onBack = {
                    showEntryForm = false
                    entryToEdit = null
                    pendingScannedValue = null
                },
                onDismiss = {
                    selectedPosition = null
                    showEntryForm = false
                    entryToEdit = null
                    pendingScannedValue = null
                }
            )
        }
    }
}

@Composable
private fun ShelfPositionRow(
    position: ShelfPosition,
    entries: List<ShelfEntry>,
    articles: List<Article>,
    onClick: () -> Unit
) {
    val hasEntries = entries.isNotEmpty()
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (hasEntries)
                MaterialTheme.colorScheme.secondaryContainer
            else
                MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Column(horizontalAlignment = Alignment.Start, modifier = Modifier.widthIn(min = 72.dp)) {
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Text(
                        position.code,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                if (position.description != null) {
                    Text(
                        position.description,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        maxLines = 2,
                        modifier = Modifier.widthIn(max = 80.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                if (hasEntries) {
                    entries.forEach { entry ->
                        val art = articles.find { it.id == entry.articleId }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(bottom = 2.dp)
                        ) {
                            Text(
                                art?.name ?: "Articolo #${entry.articleId}",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Surface(
                                shape = MaterialTheme.shapes.extraSmall,
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    "${entry.quantity}",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        val meta = listOfNotNull(
                            entry.batch?.let { "L:$it" },
                            entry.expiry?.let { "Scad:$it" }
                        ).joinToString(" · ")
                        if (meta.isNotBlank()) {
                            Text(
                                meta,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                        }
                    }
                } else {
                    Text(
                        "Vuoto",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            }
            Icon(
                Icons.Default.Edit,
                contentDescription = "Gestisci",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShelfPositionEntriesDialog(
    position: ShelfPosition,
    entries: List<ShelfEntry>,
    articles: List<Article>,
    shelfPositions: List<ShelfPosition>,
    onAddNew: () -> Unit,
    onEditEntry: (ShelfEntry) -> Unit,
    onDeleteEntry: (Int) -> Unit,
    onMoveEntry: (id: Int, newPositionCode: String) -> Unit,
    onCopyEntry: (articleId: Int, positionCode: String, quantity: Int, batch: String?, expiry: String?) -> Unit,
    onDismiss: () -> Unit
) {
    var entryToMove by remember { mutableStateOf<ShelfEntry?>(null) }
    var entryToCopy by remember { mutableStateOf<ShelfEntry?>(null) }

    entryToMove?.let { entry ->
        MoveEntryDialog(
            entry = entry,
            currentPositionCode = position.code,
            shelfPositions = shelfPositions,
            articles = articles,
            onConfirm = { newCode ->
                onMoveEntry(entry.id, newCode)
                entryToMove = null
                onDismiss()
            },
            onDismiss = { entryToMove = null }
        )
    }

    entryToCopy?.let { entry ->
        CopyEntryDialog(
            entry = entry,
            currentPositionCode = position.code,
            shelfPositions = shelfPositions,
            articles = articles,
            onConfirm = { targetPosCode, qty, batch, expiry ->
                onCopyEntry(entry.articleId, targetPosCode, qty, batch, expiry)
                entryToCopy = null
                onDismiss()
            },
            onDismiss = { entryToCopy = null }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ViewModule, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(position.code, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                if (position.description != null) {
                    Text(position.description, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (entries.isEmpty()) {
                    Text("Posizione vuota", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                } else {
                    entries.forEach { entry ->
                        val art = articles.find { it.id == entry.articleId }
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    // Riga 1: nome + codice
                                    Text(
                                        art?.name ?: "Articolo #${entry.articleId}",
                                        fontWeight = FontWeight.SemiBold,
                                        style = MaterialTheme.typography.bodySmall,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(art?.code ?: "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    // Riga 2: quantità + peso totale
                                    val totalWeight = art?.let { (entry.quantity * it.weightPerUnit).let { w -> if (w == w.toLong().toFloat()) w.toLong().toString() else "%.1f".format(w) } }
                                    val qtyText = if (totalWeight != null && art?.unit != null && art.weightPerUnit != 1f)
                                        "Qt: ${entry.quantity} pz / $totalWeight ${art.unit}"
                                    else
                                        "Qt: ${entry.quantity} ${art?.unit ?: ""}"
                                    Surface(shape = MaterialTheme.shapes.extraSmall, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), modifier = Modifier.padding(top = 4.dp)) {
                                        Text(qtyText.trim(), modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                    }
                                    // Riga 3: lotto + scadenza
                                    if (entry.batch != null || entry.expiry != null) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 2.dp)) {
                                            if (entry.batch != null) Text("L: ${entry.batch}", style = MaterialTheme.typography.labelSmall)
                                            if (entry.expiry != null) Text("Scad: ${entry.expiry}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                }
                                // Pulsanti in colonna a destra
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    IconButton(onClick = { entryToMove = entry }, modifier = Modifier.size(40.dp)) {
                                        Icon(Icons.Default.SwapHoriz, "Sposta", tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(22.dp))
                                    }
                                    IconButton(onClick = { entryToCopy = entry }, modifier = Modifier.size(40.dp)) {
                                        Icon(Icons.Default.ContentCopy, "Copia", tint = Color(0xFF7C3AED), modifier = Modifier.size(22.dp))
                                    }
                                    IconButton(onClick = { onEditEntry(entry) }, modifier = Modifier.size(40.dp)) {
                                        Icon(Icons.Default.Edit, "Modifica", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
                                    }
                                    IconButton(onClick = { onDeleteEntry(entry.id) }, modifier = Modifier.size(40.dp)) {
                                        Icon(Icons.Default.Delete, "Rimuovi", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(22.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onAddNew) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Aggiungi prodotto")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Chiudi") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShelfEntryEditDialog(
    position: ShelfPosition,
    entryToEdit: ShelfEntry?,
    articles: List<Article>,
    initialScannedValue: String?,
    onScanRequest: () -> Unit,
    onSave: (articleId: Int, quantity: Int, batch: String?, expiry: String?) -> Unit,
    onBack: () -> Unit,
    onDismiss: () -> Unit
) {
    val isEdit = entryToEdit != null
    val fixedArticle = if (isEdit) articles.find { it.id == entryToEdit!!.articleId } else null

    var searchQuery by remember { mutableStateOf(fixedArticle?.code ?: "") }
    var selectedArticle by remember { mutableStateOf<Article?>(fixedArticle) }
    var showDropdown by remember { mutableStateOf(false) }
    var quantityInput by remember { mutableStateOf((entryToEdit?.quantity ?: 0).toString()) }
    var batchInput by remember { mutableStateOf(entryToEdit?.batch ?: "") }
    var expiryInput by remember { mutableStateOf(entryToEdit?.expiry ?: "") }
    var showProductList by remember { mutableStateOf(false) }

    LaunchedEffect(initialScannedValue) {
        if (!initialScannedValue.isNullOrBlank()) {
            val matched = articles.find { it.barcode == initialScannedValue || it.code == initialScannedValue }
            selectedArticle = matched
            searchQuery = matched?.code ?: initialScannedValue
            showDropdown = matched == null && initialScannedValue.length >= 2
        }
    }

    val filteredArticles = remember(searchQuery, articles) {
        if (searchQuery.length >= 2) {
            articles.filter {
                it.code.contains(searchQuery, ignoreCase = true) ||
                it.name.contains(searchQuery, ignoreCase = true) ||
                it.barcode?.contains(searchQuery, ignoreCase = true) == true
            }.take(8)
        } else emptyList()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(4.dp))
                Column {
                    Text(if (isEdit) "Modifica" else "Aggiungi prodotto")
                    Text(position.code, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!isEdit) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = {
                            searchQuery = it
                            selectedArticle = null
                            showDropdown = it.length >= 2
                        },
                        label = { Text("Cerca prodotto") },
                        singleLine = true,
                        trailingIcon = {
                            Row {
                                IconButton(onClick = { showProductList = true }) {
                                    Icon(Icons.Default.ViewList, contentDescription = "Lista prodotti")
                                }
                                IconButton(onClick = onScanRequest) {
                                    Icon(Icons.Default.QrCodeScanner, contentDescription = "Scansiona")
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (showDropdown && filteredArticles.isNotEmpty()) {
                        Card(elevation = CardDefaults.cardElevation(4.dp), modifier = Modifier.fillMaxWidth()) {
                            Column {
                                filteredArticles.forEach { art ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable {
                                            selectedArticle = art
                                            searchQuery = art.code
                                            showDropdown = false
                                        }.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(art.code, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
                                            Text(art.name, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                    if (art != filteredArticles.last()) HorizontalDivider()
                                }
                            }
                        }
                    }
                }

                val displayArticle = if (isEdit) fixedArticle else selectedArticle
                if (displayArticle != null) {
                    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.small) {
                        Row(modifier = Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(6.dp))
                            Text("${displayArticle.name} (${displayArticle.code})", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                OutlinedTextField(
                    value = quantityInput,
                    onValueChange = { quantityInput = it },
                    label = { Text("Quantità") },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Numbers, null, Modifier.size(18.dp)) },
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
            }
        },
        confirmButton = {
            val articleId = if (isEdit) entryToEdit!!.articleId else selectedArticle?.id
            Button(
                onClick = {
                    if (articleId != null) {
                        onSave(
                            articleId,
                            quantityInput.toIntOrNull() ?: 0,
                            batchInput.trim().takeIf { it.isNotBlank() },
                            expiryInput.trim().takeIf { it.isNotBlank() }
                        )
                    }
                },
                enabled = if (isEdit) true else selectedArticle != null
            ) {
                Text("Salva")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annulla") }
        }
    )

    if (showProductList) {
        ProductListPickerDialog(
            articles = articles,
            onSelect = { art ->
                selectedArticle = art
                searchQuery = art.code
                showDropdown = false
                showProductList = false
            },
            onDismiss = { showProductList = false }
        )
    }
}

@Composable
private fun MoveEntryDialog(
    entry: ShelfEntry,
    currentPositionCode: String,
    shelfPositions: List<ShelfPosition>,
    articles: List<Article>,
    onConfirm: (newPositionCode: String) -> Unit,
    onDismiss: () -> Unit
) {
    val art = articles.find { it.id == entry.articleId }
    val availablePositions = shelfPositions.filter { it.isActive && it.code != currentPositionCode }
    var selectedCode by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }

    val filtered = remember(searchQuery, availablePositions) {
        if (searchQuery.isBlank()) availablePositions
        else availablePositions.filter {
            it.code.contains(searchQuery, ignoreCase = true) ||
            it.description?.contains(searchQuery, ignoreCase = true) == true
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.SwapHoriz, null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Sposta prodotto")
                }
                Text(
                    art?.name ?: "Articolo #${entry.articleId}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        "Da: $currentPositionCode",
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it; selectedCode = "" },
                    label = { Text("Cerca posizione...") },
                    leadingIcon = { Icon(Icons.Default.Search, null, Modifier.size(18.dp)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 260.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(filtered) { pos ->
                        val isSelected = pos.code == selectedCode
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = if (isSelected)
                                MaterialTheme.colorScheme.primaryContainer
                            else
                                MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedCode = pos.code }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (isSelected) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(pos.code, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                                    if (!pos.description.isNullOrBlank()) {
                                        Text(pos.description, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }

                if (selectedCode.isNotBlank()) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            "→ $selectedCode",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (selectedCode.isNotBlank()) onConfirm(selectedCode) },
                enabled = selectedCode.isNotBlank()
            ) {
                Icon(Icons.Default.SwapHoriz, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Sposta")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annulla") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CopyEntryDialog(
    entry: ShelfEntry,
    currentPositionCode: String,
    shelfPositions: List<ShelfPosition>,
    articles: List<Article>,
    onConfirm: (targetPosCode: String, quantity: Int, batch: String?, expiry: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val art = articles.find { it.id == entry.articleId }
    val availablePositions = shelfPositions.filter { it.isActive && it.code != currentPositionCode }
    var selectedCode by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }
    var quantityInput by remember { mutableStateOf((entry.quantity).toString()) }
    var batchInput by remember { mutableStateOf(entry.batch ?: "") }
    var expiryInput by remember { mutableStateOf(entry.expiry ?: "") }

    val filtered = remember(searchQuery, availablePositions) {
        if (searchQuery.isBlank()) availablePositions
        else availablePositions.filter {
            it.code.contains(searchQuery, ignoreCase = true) ||
            it.description?.contains(searchQuery, ignoreCase = true) == true
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ContentCopy, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Copia prodotto")
                }
                Text(
                    art?.name ?: "Articolo #${entry.articleId}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.4f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        "Da: $currentPositionCode",
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }

                // Editable fields
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = quantityInput,
                        onValueChange = { quantityInput = it },
                        label = { Text("Qt") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = batchInput,
                        onValueChange = { batchInput = it },
                        label = { Text("Lotto") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = expiryInput,
                    onValueChange = { expiryInput = it },
                    label = { Text("Scadenza") },
                    placeholder = { Text("MM/AAAA") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it; selectedCode = "" },
                    label = { Text("Cerca posizione...") },
                    leadingIcon = { Icon(Icons.Default.Search, null, Modifier.size(18.dp)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(filtered) { pos ->
                        val isSelected = pos.code == selectedCode
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = if (isSelected)
                                MaterialTheme.colorScheme.primaryContainer
                            else
                                MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedCode = pos.code }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (isSelected) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(pos.code, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                                    if (!pos.description.isNullOrBlank()) {
                                        Text(pos.description, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }

                if (selectedCode.isNotBlank()) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            "→ $selectedCode",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedCode.isNotBlank()) {
                        onConfirm(
                            selectedCode,
                            quantityInput.toIntOrNull() ?: 0,
                            batchInput.trim().takeIf { it.isNotBlank() },
                            expiryInput.trim().takeIf { it.isNotBlank() }
                        )
                    }
                },
                enabled = selectedCode.isNotBlank() && (quantityInput.toIntOrNull() ?: 0) > 0
            ) {
                Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Copia")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annulla") }
        }
    )
}
