package com.molinobriganti.inventory.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfPosition
import com.molinobriganti.inventory.ui.theme.*
import com.molinobriganti.inventory.viewmodel.LoadMerceState
import com.molinobriganti.inventory.viewmodel.LoadStep

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoadMerceScreen(
    state: LoadMerceState,
    articles: List<Article>,
    shelfPositions: List<ShelfPosition>,
    onShelfScanned: (String) -> Unit,
    onProductScanned: (String) -> Unit,
    onQuantityChanged: (String) -> Unit,
    onBatchChanged: (String) -> Unit,
    onExpiryChanged: (String) -> Unit,
    onNotesChanged: (String) -> Unit,
    onGoToConfirm: () -> Unit,
    onGoBack: () -> Unit,
    onSave: () -> Unit,
    onReset: () -> Unit,
    onBack: () -> Unit
) {
    var showShelfScanner by remember { mutableStateOf(false) }
    var showProductScanner by remember { mutableStateOf(false) }

    if (showShelfScanner) {
        BarcodeScannerScreen(
            title = "Scansiona Scaffale",
            instruction = "Inquadra il barcode dello scaffale",
            onBarcodeScanned = { barcode ->
                showShelfScanner = false
                onShelfScanned(barcode)
            },
            onClose = { showShelfScanner = false }
        )
        return
    }

    if (showProductScanner) {
        BarcodeScannerScreen(
            title = "Scansiona Prodotto",
            instruction = "Inquadra il barcode del prodotto",
            onBarcodeScanned = { barcode ->
                showProductScanner = false
                onProductScanned(barcode)
                // Try to find matching article
            },
            onClose = { showProductScanner = false }
        )
        return
    }

    // Success screen
    if (state.saveSuccess) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(80.dp),
                    tint = StockOk
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Carico salvato con successo!",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(onClick = onReset) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Nuovo Carico")
                }
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                    Text("Carico Merce")
                }
            },
            navigationIcon = {
                IconButton(onClick = {
                    if (state.currentStep == LoadStep.SCAN_SHELF) onBack()
                    else onGoBack()
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                }
            }
        )

        // Step indicator
        StepIndicator(currentStep = state.currentStep)

        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            when (state.currentStep) {
                LoadStep.SCAN_SHELF -> ShelfStep(
                    shelfBarcode = state.shelfBarcode,
                    shelfPositions = shelfPositions,
                    onScan = { showShelfScanner = true },
                    onManualEntry = onShelfScanned
                )

                LoadStep.SCAN_PRODUCT -> ProductStep(
                    productBarcode = state.productBarcode,
                    matchedArticle = state.matchedArticle,
                    onScan = { showProductScanner = true },
                    onManualEntry = onProductScanned,
                    articles = articles
                )

                LoadStep.ENTER_DETAILS -> DetailsStep(
                    state = state,
                    onQuantityChanged = onQuantityChanged,
                    onBatchChanged = onBatchChanged,
                    onExpiryChanged = onExpiryChanged,
                    onNotesChanged = onNotesChanged,
                    onNext = onGoToConfirm
                )

                LoadStep.CONFIRM -> ConfirmStep(
                    state = state,
                    onSave = onSave,
                    isSaving = state.isSaving
                )
            }
        }
    }
}

@Composable
fun StepIndicator(currentStep: LoadStep) {
    val steps = listOf("Scaffale", "Prodotto", "Dettagli", "Conferma")
    val currentIndex = currentStep.ordinal

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        steps.forEachIndexed { index, label ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f)
            ) {
                Surface(
                    shape = MaterialTheme.shapes.extraLarge,
                    color = when {
                        index < currentIndex -> StockOk
                        index == currentIndex -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (index < currentIndex) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        } else {
                            Text(
                                "${index + 1}",
                                color = if (index == currentIndex)
                                    MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (index <= currentIndex)
                        MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
    HorizontalDivider()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShelfStep(
    shelfBarcode: String,
    shelfPositions: List<ShelfPosition>,
    onScan: () -> Unit,
    onManualEntry: (String) -> Unit
) {
    var manualCode by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    val filteredPositions = remember(manualCode, shelfPositions) {
        if (manualCode.isBlank()) {
            shelfPositions.filter { it.isActive }
        } else {
            shelfPositions.filter { pos ->
                pos.isActive && (
                    pos.code.contains(manualCode, ignoreCase = true) ||
                    (pos.description?.contains(manualCode, ignoreCase = true) == true)
                )
            }
        }
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.QrCodeScanner,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                "Scansiona il barcode dello scaffale",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Button(
                onClick = onScan,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Scansiona Scaffale")
            }

            HorizontalDivider()

            Text(
                "Oppure seleziona posizione:",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = manualCode,
                    onValueChange = {
                        manualCode = it
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
                                manualCode = pos.code
                                expanded = false
                                onManualEntry(pos.code)
                            }
                        )
                    }
                }
            }

            if (manualCode.isNotBlank()) {
                FilledTonalButton(
                    onClick = { onManualEntry(manualCode) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.ArrowForward, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Usa: $manualCode")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductStep(
    productBarcode: String,
    matchedArticle: Article?,
    onScan: () -> Unit,
    onManualEntry: (String) -> Unit,
    articles: List<Article>
) {
    var manualCode by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    var showProductList by remember { mutableStateOf(false) }
    val filteredArticles = remember(manualCode, articles) {
        if (manualCode.length >= 2) {
            articles.filter {
                it.code.contains(manualCode, ignoreCase = true) ||
                    it.name.contains(manualCode, ignoreCase = true)
            }.take(5)
        } else emptyList()
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                Icons.Default.QrCodeScanner,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                "Scansiona il barcode del prodotto",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Button(
                onClick = onScan,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Scansiona Prodotto")
            }

            HorizontalDivider()

            Text(
                "Oppure cerca per codice/nome:",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            ExposedDropdownMenuBox(
                expanded = expanded && filteredArticles.isNotEmpty(),
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = manualCode,
                    onValueChange = {
                        manualCode = it
                        expanded = true
                    },
                    label = { Text("Codice o nome prodotto") },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(onClick = { showProductList = true }) {
                            Icon(Icons.Default.ViewList, contentDescription = "Lista prodotti")
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = expanded && filteredArticles.isNotEmpty(),
                    onDismissRequest = { expanded = false }
                ) {
                    filteredArticles.forEach { article ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(article.name, fontWeight = FontWeight.Medium)
                                    Text(
                                        article.code,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            },
                            onClick = {
                                manualCode = article.code
                                expanded = false
                                onManualEntry(article.code)
                            }
                        )
                    }
                }
            }

            if (manualCode.isNotBlank() && filteredArticles.isEmpty()) {
                FilledTonalButton(
                    onClick = { onManualEntry(manualCode) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Usa codice: $manualCode")
                }
            }
        }
    }

    if (showProductList) {
        ProductListPickerDialog(
            articles = articles,
            onSelect = { article ->
                manualCode = article.code
                expanded = false
                showProductList = false
                onManualEntry(article.code)
            },
            onDismiss = { showProductList = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailsStep(
    state: LoadMerceState,
    onQuantityChanged: (String) -> Unit,
    onBatchChanged: (String) -> Unit,
    onExpiryChanged: (String) -> Unit,
    onNotesChanged: (String) -> Unit,
    onNext: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Show matched article info
            if (state.matchedArticle != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = MaterialTheme.shapes.medium
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            state.matchedArticle.name,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Codice: ${state.matchedArticle.code}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Giacenza attuale: ${state.matchedArticle.inventory?.currentStock ?: 0} ${state.matchedArticle.unit}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            OutlinedTextField(
                value = state.quantity,
                onValueChange = { onQuantityChanged(it.filter { c -> c.isDigit() }) },
                label = { Text("Quantità *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                leadingIcon = { Icon(Icons.Default.Inventory2, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = state.batch,
                onValueChange = onBatchChanged,
                label = { Text("Numero Lotto") },
                leadingIcon = { Icon(Icons.Default.Tag, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = state.expiry,
                onValueChange = onExpiryChanged,
                label = { Text("Data Scadenza") },
                placeholder = { Text("GG/MM/AAAA") },
                leadingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = state.notes,
                onValueChange = onNotesChanged,
                label = { Text("Note (opzionale)") },
                leadingIcon = { Icon(Icons.Default.Notes, contentDescription = null) },
                maxLines = 3,
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = onNext,
                enabled = state.quantity.isNotBlank() &&
                    (state.quantity.toIntOrNull() ?: 0) > 0,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Avanti")
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfirmStep(
    state: LoadMerceState,
    onSave: () -> Unit,
    isSaving: Boolean
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Riepilogo Carico",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            HorizontalDivider()

            ConfirmRow("Scaffale", state.shelfBarcode)
            ConfirmRow("Prodotto", state.matchedArticle?.name ?: state.productBarcode)
            ConfirmRow("Codice", state.productBarcode)
            ConfirmRow("Quantità", state.quantity)
            if (state.batch.isNotBlank()) {
                ConfirmRow("Lotto", state.batch)
            }
            if (state.expiry.isNotBlank()) {
                ConfirmRow("Scadenza", state.expiry)
            }
            if (state.notes.isNotBlank()) {
                ConfirmRow("Note", state.notes)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = onSave,
                enabled = !isSaving,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = StockOk
                )
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(Icons.Default.Save, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Conferma e Salva")
                }
            }
        }
    }

    if (state.error != null) {
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer
            )
        ) {
            Text(
                text = state.error,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}

@Composable
fun ConfirmRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(100.dp)
        )
        Text(value, fontWeight = FontWeight.SemiBold)
    }
}
