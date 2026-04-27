package com.molinobriganti.inventory.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfEntry
import com.molinobriganti.inventory.ui.theme.*
import com.molinobriganti.inventory.viewmodel.ArticleListState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleListScreen(
    uiState: ArticleListState,
    shelfEntries: List<ShelfEntry> = emptyList(),
    logoUrl: String? = null,
    onSearchChanged: (String) -> Unit,
    onCategorySelected: (String?) -> Unit,
    onArticleClick: (Article) -> Unit,
    onRefresh: () -> Unit,
    onCreateNew: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        com.molinobriganti.inventory.ui.components.TopBarCompanyLogo()
                        Text("Articoli")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateNew) {
                Icon(Icons.Default.Add, contentDescription = "Nuovo articolo")
            }
        }
    ) { scaffoldPadding ->
    Column(modifier = Modifier.fillMaxSize().padding(scaffoldPadding)) {
        // Search bar
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = onSearchChanged,
            placeholder = { Text("Cerca per nome, codice o categoria…") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        )

        // Category chips
        if (uiState.categories.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                item {
                    FilterChip(
                        selected = uiState.selectedCategory == null,
                        onClick = { onCategorySelected(null) },
                        label = { Text("Tutte") }
                    )
                }
                items(uiState.categories) { category ->
                    FilterChip(
                        selected = uiState.selectedCategory == category,
                        onClick = { onCategorySelected(category) },
                        label = { Text(category) }
                    )
                }
            }
        }

        // Content
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.error != null -> {
                Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = uiState.error,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onRefresh) {
                            Text("Riprova")
                        }
                    }
                }
            }

            uiState.filteredArticles.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inventory2,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Nessun articolo trovato",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(
                        items = uiState.filteredArticles,
                        key = { it.id }
                    ) { article ->
                        ArticleCard(
                            article = article,
                            totalStock = shelfEntries.filter { it.articleId == article.id }.sumOf { it.quantity },
                            onClick = { onArticleClick(article) }
                        )
                    }
                }
            }
        }
    }
    }
}

@Composable
fun ArticleCard(
    article: Article,
    totalStock: Int = article.inventory?.currentStock ?: 0,
    showStock: Boolean = true,
    onClick: () -> Unit,
    onEdit: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null
) {
    val inventory = article.inventory
    val stockColor = when {
        totalStock <= 0 -> StockCritical
        inventory != null && inventory.minimumStock > 0 && totalStock <= inventory.minimumStock -> StockLow
        else -> StockOk
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Stock indicator
            if (showStock) {
            val totalKg = totalStock * article.weightPerUnit
            val kgFormatted = if (totalKg % 1 == 0f) totalKg.toInt().toString() else "%.1f".format(totalKg)
            Surface(
                shape = MaterialTheme.shapes.small,
                color = stockColor.copy(alpha = 0.15f),
                modifier = Modifier.defaultMinSize(minWidth = 60.dp, minHeight = 56.dp)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "$totalStock",
                        fontWeight = FontWeight.Bold,
                        color = stockColor,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "colli",
                        style = MaterialTheme.typography.labelSmall,
                        color = stockColor.copy(alpha = 0.8f),
                        maxLines = 1
                    )
                    Text(
                        text = "$kgFormatted kg",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1
                    )
                }
            }
            } // end showStock

            Spacer(modifier = Modifier.width(16.dp))

            // Article info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = article.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = article.code,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (article.category != null) {
                    Text(
                        text = article.category,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Optional action buttons (shown only in edit contexts like Settings)
            if (onEdit != null || onDelete != null) {
                Spacer(modifier = Modifier.width(4.dp))
                if (onEdit != null) {
                    IconButton(onClick = onEdit, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Modifica",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                if (onDelete != null) {
                    IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
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
