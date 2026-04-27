package com.molinobriganti.inventory.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.molinobriganti.inventory.data.model.Article

// Categorie predefinite allineate con il pannello web (warehouse-management.html)
private val DEFAULT_CATEGORIES = listOf(
    "FARINE",
    "MIX FARINE",
    "SEMOLE",
    "CEREALI",
    "CEREALI PERLATI",
    "MANGIMI",
    "ALTRO"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleEditScreen(
    article: Article?,  // null = creazione nuovo
    isLoading: Boolean,
    knownCategories: List<String> = emptyList(),
    onBack: () -> Unit,
    onSave: (code: String, name: String, description: String?, category: String?, unit: String, weightPerUnit: Float, barcode: String?, minimumStock: Int, criticalStock: Int) -> Unit
) {
    var code by remember { mutableStateOf(article?.code ?: "") }
    var name by remember { mutableStateOf(article?.name ?: "") }
    var description by remember { mutableStateOf(article?.description ?: "") }
    var category by remember { mutableStateOf(article?.category ?: "") }
    var unit by remember { mutableStateOf(article?.unit ?: "kg") }
    var weightPerUnit by remember {
        val w = article?.weightPerUnit ?: 1f
        // Remove trailing zeros: 5.0 → "5", 5.5 → "5.5"
        mutableStateOf(if (w == w.toInt().toFloat()) w.toInt().toString() else w.toString())
    }
    var barcode by remember { mutableStateOf(article?.barcode ?: "") }
    var minimumStock by remember { mutableStateOf((article?.inventory?.minimumStock ?: 0).toString()) }
    var criticalStock by remember { mutableStateOf((article?.inventory?.criticalStock ?: 0).toString()) }
    var showBarcodeScanner by remember { mutableStateOf(false) }

    val isNew = article == null
    val isValid = code.isNotBlank() && name.isNotBlank()

    if (showBarcodeScanner) {
        BarcodeScannerScreen(
            title = "Scansiona Codice a Barre",
            instruction = "Inquadra il codice a barre del prodotto",
            onBarcodeScanned = { scanned ->
                barcode = scanned
                showBarcodeScanner = false
            },
            onClose = { showBarcodeScanner = false }
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                    Text(if (isNew) "Nuovo Articolo" else "Modifica Articolo")
                }
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                }
            },
            actions = {
                IconButton(
                    onClick = {
                        onSave(
                            code.trim(),
                            name.trim(),
                            description.trim().ifBlank { null },
                            category.trim().ifBlank { null },
                            unit.trim().ifBlank { "kg" },
                            weightPerUnit.trim().replace(',', '.').toFloatOrNull() ?: 1f,
                            barcode.trim().ifBlank { null },
                            minimumStock.trim().toIntOrNull() ?: 0,
                            criticalStock.trim().toIntOrNull() ?: 0
                        )
                    },
                    enabled = isValid && !isLoading
                ) {
                    Icon(Icons.Default.Save, contentDescription = "Salva")
                }
            }
        )

        if (isLoading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it },
                label = { Text("Codice *") },
                placeholder = { Text("es. F-0-SP35-5") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nome *") },
                placeholder = { Text("es. FARINA 0 SP35 da 5 kg") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Descrizione") },
                placeholder = { Text("Descrizione del prodotto") },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth()
            )

            // Dropdown categoria con suggerimenti dinamici (server) + default allineati al web
            var categoryExpanded by remember { mutableStateOf(false) }
            val categoryOptions = remember(knownCategories) {
                // Preserva l'ordine definito sul server (knownCategories arriva già ordinato).
                // I default vengono aggiunti SOLO se la lista server è vuota.
                val base = knownCategories.map { it.uppercase() }.filter { it.isNotBlank() }
                val merged = if (base.isEmpty()) DEFAULT_CATEGORIES.map { it.uppercase() } else base
                merged.distinct()
            }
            ExposedDropdownMenuBox(
                expanded = categoryExpanded,
                onExpandedChange = { categoryExpanded = !categoryExpanded }
            ) {
                OutlinedTextField(
                    value = category,
                    onValueChange = {
                        category = it.uppercase()
                        categoryExpanded = true
                    },
                    label = { Text("Categoria") },
                    placeholder = { Text("es. FARINE, SEMOLE, MANGIMI") },
                    singleLine = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = categoryExpanded && categoryOptions.isNotEmpty(),
                    onDismissRequest = { categoryExpanded = false }
                ) {
                    categoryOptions.forEach { opt ->
                        DropdownMenuItem(
                            text = { Text(opt) },
                            onClick = {
                                category = opt
                                categoryExpanded = false
                            }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = unit,
                onValueChange = { unit = it },
                label = { Text("Unità di misura") },
                placeholder = { Text("es. kg, pz, lt") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = weightPerUnit,
                onValueChange = { weightPerUnit = it },
                label = { Text("Peso per collo (kg)") },
                placeholder = { Text("es. 5, 10, 25") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = barcode,
                onValueChange = { barcode = it },
                label = { Text("Codice a Barre") },
                placeholder = { Text("es. 8001234567890") },
                singleLine = true,
                trailingIcon = {
                    IconButton(onClick = { showBarcodeScanner = true }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scansiona barcode")
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )

            // Soglie giacenza
            HorizontalDivider()
            Text(
                "Soglie avvisi giacenza",
                style = MaterialTheme.typography.titleSmall
            )
            Text(
                "Imposta 0 per disattivare l'avviso. La soglia critica deve essere ≤ soglia avviso.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = minimumStock,
                    onValueChange = { v -> minimumStock = v.filter { it.isDigit() }.take(6) },
                    label = { Text("⚠️ Avviso (colli)") },
                    placeholder = { Text("es. 10") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = criticalStock,
                    onValueChange = { v -> criticalStock = v.filter { it.isDigit() }.take(6) },
                    label = { Text("🚨 Critica (colli)") },
                    placeholder = { Text("es. 3") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    onSave(
                        code.trim(),
                        name.trim(),
                        description.trim().ifBlank { null },
                        category.trim().ifBlank { null },
                        unit.trim().ifBlank { "kg" },
                        weightPerUnit.trim().replace(',', '.').toFloatOrNull() ?: 1f,
                        barcode.trim().ifBlank { null },
                        minimumStock.trim().toIntOrNull() ?: 0,
                        criticalStock.trim().toIntOrNull() ?: 0
                    )
                },
                enabled = isValid && !isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (isNew) "Crea Articolo" else "Salva Modifiche")
            }
        }
    }
}
