package com.molinobriganti.inventory.ui.screens

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfEntry
import com.molinobriganti.inventory.data.model.ShelfPosition
import com.molinobriganti.inventory.util.NaturalOrderComparator
import java.text.SimpleDateFormat
import java.util.*

// ── Filter options ────────────────────────────────────────────────────────────
enum class PrintFilter(val label: String) {
    ALL("Tutto l'inventario"),
    SECTOR("Settore scaffale"),
    CATEGORY("Categoria articolo"),
    STOCK_GT0("Solo articoli con giacenza"),
    STOCK_LOW("Solo articoli sottoscorta")
}

// ── Sort options ──────────────────────────────────────────────────────────────
enum class PrintSort(val label: String) {
    POSITION("Posizione scaffale"),
    CODE("Codice articolo"),
    NAME("Nome articolo"),
    CATEGORY("Categoria"),
    STOCK_DESC("Giacenza (decrescente)")
}

// ── Format options ────────────────────────────────────────────────────────────
enum class PrintFormat(val label: String) {
    PER_POSITION("Una riga per posizione scaffale"),
    PER_ARTICLE("Una riga per articolo (totali)")
}

// ── Print destination ─────────────────────────────────────────────────────────
enum class PrintDestination(val label: String, val subtitle: String, val icon: ImageVector) {
    PRINTER("Stampante di rete", "WiFi, Bluetooth, cloud", Icons.Default.Print),
    PDF("Salva come PDF", "Condividi o archivia", Icons.Default.PictureAsPdf)
}

// ── Main screen ───────────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrintInventoryScreen(
    shelfPositions: List<ShelfPosition>,
    articles: List<Article>,
    shelfEntries: List<ShelfEntry>,
    onBack: () -> Unit
) {
    val context = LocalContext.current

    // ── State ─────────────────────────────────────────────────────────────────
    var selectedFilter by remember { mutableStateOf(PrintFilter.ALL) }
    var selectedFilterValue by remember { mutableStateOf("") }
    var selectedSort by remember { mutableStateOf(PrintSort.POSITION) }
    var selectedFormat by remember { mutableStateOf(PrintFormat.PER_POSITION) }
    var reportTitle by remember { mutableStateOf("") }
    var selectedDestination by remember { mutableStateOf(PrintDestination.PRINTER) }

    // Dropdown expand states
    var filterExpanded by remember { mutableStateOf(false) }
    var filterValueExpanded by remember { mutableStateOf(false) }
    var sortExpanded by remember { mutableStateOf(false) }
    var formatExpanded by remember { mutableStateOf(false) }

    // Dynamic filter value lists
    val sectors = remember(shelfPositions) {
        shelfPositions.map { it.code.first().toString() }.distinct().sorted()
    }
    val categories = remember(articles) {
        articles.mapNotNull { it.category }.distinct().sorted()
    }

    // Reset filterValue when filter changes
    LaunchedEffect(selectedFilter) {
        selectedFilterValue = when (selectedFilter) {
            PrintFilter.SECTOR -> sectors.firstOrNull() ?: ""
            PrintFilter.CATEGORY -> categories.firstOrNull() ?: ""
            else -> ""
        }
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Stampa Inventario") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val html = buildInventoryHtml(
                            articles, shelfPositions, shelfEntries,
                            selectedFilter, selectedFilterValue,
                            selectedSort, selectedFormat,
                            reportTitle.ifBlank { "Inventario Magazzino" }
                        )
                        printHtml(context, html, selectedDestination)
                    }) {
                        Icon(Icons.Default.Print, contentDescription = "Stampa")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // Title
            OutlinedTextField(
                value = reportTitle,
                onValueChange = { reportTitle = it },
                label = { Text("Titolo stampa (opzionale)") },
                placeholder = { Text("Es: Inventario Aprile 2026") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Filter
            DropdownCard(
                label = "Filtra per",
                value = selectedFilter.label,
                expanded = filterExpanded,
                onToggle = { filterExpanded = !filterExpanded },
                onDismiss = { filterExpanded = false }
            ) {
                PrintFilter.entries.forEach { f ->
                    DropdownMenuItem(
                        text = { Text(f.label) },
                        onClick = { selectedFilter = f; filterExpanded = false }
                    )
                }
            }

            // Filter value (sector or category)
            if (selectedFilter == PrintFilter.SECTOR || selectedFilter == PrintFilter.CATEGORY) {
                val valueList = if (selectedFilter == PrintFilter.SECTOR) sectors else categories
                DropdownCard(
                    label = if (selectedFilter == PrintFilter.SECTOR) "Settore" else "Categoria",
                    value = selectedFilterValue.ifBlank { valueList.firstOrNull() ?: "–" },
                    expanded = filterValueExpanded,
                    onToggle = { filterValueExpanded = !filterValueExpanded },
                    onDismiss = { filterValueExpanded = false }
                ) {
                    valueList.forEach { v ->
                        DropdownMenuItem(
                            text = { Text(if (selectedFilter == PrintFilter.SECTOR) "Settore $v" else v) },
                            onClick = { selectedFilterValue = v; filterValueExpanded = false }
                        )
                    }
                }
            }

            // Sort
            DropdownCard(
                label = "Ordina per",
                value = selectedSort.label,
                expanded = sortExpanded,
                onToggle = { sortExpanded = !sortExpanded },
                onDismiss = { sortExpanded = false }
            ) {
                PrintSort.entries.forEach { s ->
                    DropdownMenuItem(
                        text = { Text(s.label) },
                        onClick = { selectedSort = s; sortExpanded = false }
                    )
                }
            }

            // Format
            DropdownCard(
                label = "Formato",
                value = selectedFormat.label,
                expanded = formatExpanded,
                onToggle = { formatExpanded = !formatExpanded },
                onDismiss = { formatExpanded = false }
            ) {
                PrintFormat.entries.forEach { f ->
                    DropdownMenuItem(
                        text = { Text(f.label) },
                        onClick = { selectedFormat = f; formatExpanded = false }
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // ── Destination selection ────────────────────────────────────
            Text("Destinazione stampa", style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrintDestination.entries.forEach { dest ->
                    val isSelected = selectedDestination == dest
                    val borderColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
                    val bgColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .border(2.dp, borderColor, RoundedCornerShape(10.dp))
                            .clickable { selectedDestination = dest },
                        colors = CardDefaults.cardColors(containerColor = bgColor)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(dest.icon, contentDescription = null,
                                tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.size(28.dp))
                            Text(dest.label, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                            Text(dest.subtitle, fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // Preview info
            val count = countRows(articles, shelfPositions, shelfEntries, selectedFilter, selectedFilterValue, selectedFormat)
            Text(
                "$count righe • Il sistema mostrerà la lista delle stampanti disponibili",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Print button
            Button(
                onClick = {
                    val html = buildInventoryHtml(
                        articles, shelfPositions, shelfEntries,
                        selectedFilter, selectedFilterValue,
                        selectedSort, selectedFormat,
                        reportTitle.ifBlank { "Inventario Magazzino" }
                    )
                    printHtml(context, html, selectedDestination)
                },
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Icon(selectedDestination.icon, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (selectedDestination == PrintDestination.PDF) "Genera PDF" else "Stampa su stampante")
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

// ── Helper composable ─────────────────────────────────────────────────────────
@Composable
private fun DropdownCard(
    label: String,
    value: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(4.dp))
        Box {
            OutlinedButton(
                onClick = onToggle,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(value, modifier = Modifier.weight(1f))
                Text("▾")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = onDismiss, content = content)
        }
    }
}

// ── Row counting helper ───────────────────────────────────────────────────────
private fun countRows(
    articles: List<Article>,
    shelfPositions: List<ShelfPosition>,
    shelfEntries: List<ShelfEntry>,
    filter: PrintFilter,
    filterValue: String,
    format: PrintFormat
): Int {
    return buildRows(articles, shelfPositions, shelfEntries, filter, filterValue, PrintSort.NAME, format).size
}

// ── Data row builder ──────────────────────────────────────────────────────────
private data class PrintRow(
    val position: String,
    val code: String,
    val name: String,
    val category: String,
    val quantity: Int,
    val unit: String,
    val batch: String,
    val expiry: String,
    val notes: String
)

private fun buildRows(
    articles: List<Article>,
    shelfPositions: List<ShelfPosition>,
    shelfEntries: List<ShelfEntry>,
    filter: PrintFilter,
    filterValue: String,
    sort: PrintSort,
    format: PrintFormat
): List<PrintRow> {
    val rows = mutableListOf<PrintRow>()

    if (format == PrintFormat.PER_POSITION) {
        var entries = shelfEntries.toList()
        entries = when (filter) {
            PrintFilter.SECTOR    -> entries.filter { it.positionCode.firstOrNull()?.toString() == filterValue }
            PrintFilter.CATEGORY  -> entries.filter { e -> articles.find { it.id == e.articleId }?.category == filterValue }
            PrintFilter.STOCK_GT0 -> entries.filter { it.quantity > 0 }
            PrintFilter.STOCK_LOW -> entries.filter { e ->
                val art = articles.find { it.id == e.articleId }
                art?.inventory != null && art.inventory.currentStock < art.inventory.minimumStock
            }
            PrintFilter.ALL -> entries
        }
        entries.forEach { e ->
            val art = articles.find { it.id == e.articleId }
            rows.add(PrintRow(
                position = e.positionCode,
                code = art?.code ?: "",
                name = art?.name ?: "–",
                category = art?.category ?: "–",
                quantity = e.quantity,
                unit = art?.unit ?: "pz",
                batch = e.batch ?: "",
                expiry = e.expiry ?: "",
                notes = e.notes ?: ""
            ))
        }
    } else {
        var arts = articles.toList()
        arts = when (filter) {
            PrintFilter.SECTOR    -> arts.filter { a -> shelfEntries.any { e -> e.articleId == a.id && e.positionCode.firstOrNull()?.toString() == filterValue } }
            PrintFilter.CATEGORY  -> arts.filter { it.category == filterValue }
            PrintFilter.STOCK_GT0 -> arts.filter { (it.inventory?.currentStock ?: 0) > 0 }
            PrintFilter.STOCK_LOW -> arts.filter { a -> a.inventory != null && a.inventory.currentStock < a.inventory.minimumStock }
            PrintFilter.ALL -> arts
        }
        arts.forEach { a ->
            val entries = shelfEntries.filter { it.articleId == a.id }
            rows.add(PrintRow(
                position = entries.joinToString(", ") { it.positionCode }.ifEmpty { "–" },
                code = a.code,
                name = a.name,
                category = a.category ?: "–",
                quantity = a.inventory?.currentStock ?: 0,
                unit = a.unit,
                batch = a.inventory?.batch ?: "",
                expiry = a.inventory?.expiry ?: "",
                notes = a.inventory?.notes ?: ""
            ))
        }
    }

    return rows.sortedWith(when (sort) {
        PrintSort.POSITION  -> compareBy(NaturalOrderComparator) { it.position }
        PrintSort.CODE      -> compareBy(NaturalOrderComparator) { it.code }
        PrintSort.NAME      -> compareBy({ it.name })
        PrintSort.CATEGORY  -> compareBy({ it.category }, { it.name })
        PrintSort.STOCK_DESC -> compareByDescending({ it.quantity })
    })
}

// ── HTML generator ────────────────────────────────────────────────────────────
private fun buildInventoryHtml(
    articles: List<Article>,
    shelfPositions: List<ShelfPosition>,
    shelfEntries: List<ShelfEntry>,
    filter: PrintFilter,
    filterValue: String,
    sort: PrintSort,
    format: PrintFormat,
    title: String
): String {
    val rows = buildRows(articles, shelfPositions, shelfEntries, filter, filterValue, sort, format)
    val today = SimpleDateFormat("dd/MM/yyyy", Locale.ITALY).format(Date())
    val filterLabel = when (filter) {
        PrintFilter.SECTOR    -> "Settore $filterValue"
        PrintFilter.CATEGORY  -> filterValue
        else -> filter.label
    }

    val tableRows = rows.joinToString("") { r ->
        "<tr><td>${r.position}</td><td>${r.code}</td><td>${r.name}</td><td>${r.category}</td>" +
        "<td style='text-align:right;font-weight:600'>${r.quantity} ${r.unit}</td>" +
        "<td>${r.batch}</td><td>${r.expiry}</td><td>${r.notes}</td></tr>"
    }

    return """<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<style>
@page{size:A4 landscape;margin:12mm}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0}
h1{font-size:15px;margin:0 0 3px}
.sub{font-size:9px;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th{background:#1e3a5f;color:#fff;padding:5px 7px;text-align:left;font-size:9px;text-transform:uppercase}
td{padding:4px 7px;border-bottom:1px solid #ddd;vertical-align:top}
tr:nth-child(even) td{background:#f5f7fa}
.foot{margin-top:6px;font-size:9px;color:#888;text-align:right}
</style></head><body>
<h1>&#127978; $title</h1>
<div class="sub">Data: $today &nbsp;|&nbsp; Filtro: $filterLabel &nbsp;|&nbsp;
Ordine: ${sort.label} &nbsp;|&nbsp; Formato: ${format.label} &nbsp;|&nbsp; ${rows.size} righe</div>
<table><thead><tr>
<th>Posizione</th><th>Codice</th><th>Nome Articolo</th><th>Categoria</th>
<th>Quantit&#224;</th><th>Lotto</th><th>Scadenza</th><th>Note</th>
</tr></thead><tbody>$tableRows</tbody></table>
<div class="foot">Molino Briganti &ndash; $today &ndash; ${rows.size} voci</div>
</body></html>"""
}

// ── Android print helper ──────────────────────────────────────────────────────
private fun printHtml(context: Context, html: String, destination: PrintDestination = PrintDestination.PRINTER) {
    val webView = WebView(context)
    webView.webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView, url: String) {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val jobName = "Inventario Molino Briganti"
            val printAdapter = view.createPrintDocumentAdapter(jobName)
            val attrs = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                .build()
            // Both modes open the system print dialog;
            // "Save as PDF" is always available there as a destination.
            // On Android the user picks the printer inside the system sheet.
            printManager.print(jobName, printAdapter, attrs)
        }
    }
    webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
}
