package com.molinobriganti.inventory.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.molinobriganti.inventory.data.model.Article
import com.molinobriganti.inventory.data.model.ShelfPosition

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentServerUrl: String,
    username: String,
    avatarUrl: String?,
    shelfPositions: List<ShelfPosition>,
    articles: List<Article>,
    onServerUrlChanged: (String) -> Unit,
    onCreatePosition: (String, String?) -> Unit,
    onDeletePosition: (Int) -> Unit,
    onEditArticle: (Article) -> Unit,
    onDeleteArticle: (Int) -> Unit,
    onCreateArticle: (String, String, String?) -> Unit,
    onAvatarPicked: (Uri) -> Unit,
    onLogout: () -> Unit
) {
    var serverUrl by remember { mutableStateOf(currentServerUrl) }
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showAddPositionDialog by remember { mutableStateOf(false) }
    var showPositionsList by remember { mutableStateOf(false) }
    var positionToDelete by remember { mutableStateOf<ShelfPosition?>(null) }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { onAvatarPicked(it) }
    }

    var showArticlesList by remember { mutableStateOf(false) }
    var showAddArticleDialog by remember { mutableStateOf(false) }
    var showBarcodeScannerForArticle by remember { mutableStateOf(false) }
    var articleToDelete by remember { mutableStateOf<Article?>(null) }
    var draftCode by remember { mutableStateOf("") }
    var draftName by remember { mutableStateOf("") }
    var draftBarcode by remember { mutableStateOf("") }

    if (showBarcodeScannerForArticle) {
        BarcodeScannerScreen(
            title = "Scansiona Codice a Barre",
            instruction = "Inquadra il codice a barre del prodotto",
            onBarcodeScanned = { scanned ->
                draftBarcode = scanned
                showBarcodeScannerForArticle = false
                showAddArticleDialog = true
            },
            onClose = {
                showBarcodeScannerForArticle = false
                showAddArticleDialog = true
            }
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Impostazioni") })

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // User info
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Utente",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.BottomEnd,
                                modifier = Modifier
                                    .size(72.dp)
                                    .clickable { imagePickerLauncher.launch("image/*") }
                            ) {
                                if (avatarUrl != null) {
                                    AsyncImage(
                                        model = avatarUrl,
                                        contentDescription = "Foto profilo",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(CircleShape)
                                            .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                    )
                                } else {
                                    Surface(
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.primaryContainer,
                                        modifier = Modifier.fillMaxSize()
                                    ) {
                                        Icon(
                                            Icons.Default.Person,
                                            contentDescription = null,
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .padding(16.dp),
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }
                                Surface(
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(22.dp)
                                ) {
                                    Icon(
                                        Icons.Default.CameraAlt,
                                        contentDescription = "Cambia foto",
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(4.dp),
                                        tint = MaterialTheme.colorScheme.onPrimary
                                    )
                                }
                            }
                            Column {
                                Text(
                                    text = username.ifBlank { "Non connesso" },
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.SemiBold
                                )
                                TextButton(
                                    onClick = { imagePickerLauncher.launch("image/*") },
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Text("Cambia foto profilo", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
            }

            // Server URL
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row {
                            Icon(
                                Icons.Default.Dns,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Server",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = serverUrl,
                            onValueChange = { serverUrl = it },
                            label = { Text("URL Server") },
                            placeholder = { Text("http://NAS71F89C:5000") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        FilledTonalButton(
                            onClick = { onServerUrlChanged(serverUrl) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Salva URL")
                        }
                    }
                }
            }

            // Shelf Positions
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.ViewModule,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Posizioni Scaffale",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                "${shelfPositions.size}",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilledTonalButton(
                                onClick = { showPositionsList = !showPositionsList },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    if (showPositionsList) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(if (showPositionsList) "Nascondi" else "Mostra")
                            }
                            Button(
                                onClick = { showAddPositionDialog = true }
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Aggiungi")
                            }
                        }
                    }
                }
            }

            // Positions list (expandable)
            if (showPositionsList) {
                items(shelfPositions, key = { it.id }) { pos ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    pos.code,
                                    fontWeight = FontWeight.SemiBold
                                )
                                if (pos.description != null) {
                                    Text(
                                        pos.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            IconButton(onClick = { positionToDelete = pos }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Elimina",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }

            // Gestione Prodotti
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Inventory2,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Gestione Prodotti",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                "${articles.size}",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilledTonalButton(
                                onClick = { showArticlesList = !showArticlesList },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    if (showArticlesList) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(if (showArticlesList) "Nascondi" else "Mostra")
                            }
                            Button(
                                onClick = {
                                    draftCode = ""; draftName = ""; draftBarcode = ""
                                    showAddArticleDialog = true
                                }
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Aggiungi")
                            }
                        }
                    }
                }
            }

            // Articles list (expandable)
            if (showArticlesList) {
                items(articles, key = { it.id }) { art ->
                    ArticleCard(
                        article = art,
                        showStock = false,
                        onClick = { onEditArticle(art) },
                        onEdit = { onEditArticle(art) },
                        onDelete = { articleToDelete = art }
                    )
                }
            }

            // App info
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Info App",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Molino Briganti - Inventario")
                        Text(
                            "Versione 1.2.0",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Logout
            item {
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.Logout, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Esci")
                }
            }
        }
    }

    // Add position dialog
    if (showAddPositionDialog) {
        AddPositionDialog(
            onDismiss = { showAddPositionDialog = false },
            onConfirm = { code, description ->
                onCreatePosition(code, description)
                showAddPositionDialog = false
            }
        )
    }

    // Delete position confirmation
    positionToDelete?.let { pos ->
        AlertDialog(
            onDismissRequest = { positionToDelete = null },
            title = { Text("Eliminare posizione?") },
            text = { Text("Vuoi eliminare la posizione \"${pos.code}\"?") },
            confirmButton = {
                Button(
                    onClick = {
                        onDeletePosition(pos.id)
                        positionToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Elimina")
                }
            },
            dismissButton = {
                TextButton(onClick = { positionToDelete = null }) {
                    Text("Annulla")
                }
            }
        )
    }

    // Add article dialog
    if (showAddArticleDialog) {
        AddArticleDialog(
            code = draftCode,
            name = draftName,
            barcode = draftBarcode,
            onCodeChange = { draftCode = it },
            onNameChange = { draftName = it },
            onBarcodeChange = { draftBarcode = it },
            onScanBarcode = {
                showAddArticleDialog = false
                showBarcodeScannerForArticle = true
            },
            onDismiss = { showAddArticleDialog = false },
            onConfirm = { code, name, barcode ->
                onCreateArticle(code, name, barcode)
                showAddArticleDialog = false
            }
        )
    }

    // Delete article confirmation
    articleToDelete?.let { art ->
        AlertDialog(
            onDismissRequest = { articleToDelete = null },
            title = { Text("Eliminare prodotto?") },
            text = { Text("Vuoi eliminare \"${art.name}\"?") },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteArticle(art.id)
                        articleToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Elimina")
                }
            },
            dismissButton = {
                TextButton(onClick = { articleToDelete = null }) {
                    Text("Annulla")
                }
            }
        )
    }

    // Logout dialog
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Conferma logout") },
            text = { Text("Vuoi uscire dall'app?") },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        onLogout()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Esci")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Annulla")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPositionDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, String?) -> Unit
) {
    var code by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nuova Posizione") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text("Codice *") },
                    placeholder = { Text("es. Merce a terra") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrizione (opzionale)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(code, description.ifBlank { null }) },
                enabled = code.isNotBlank()
            ) {
                Text("Crea")
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
fun AddArticleDialog(
    code: String,
    name: String,
    barcode: String,
    onCodeChange: (String) -> Unit,
    onNameChange: (String) -> Unit,
    onBarcodeChange: (String) -> Unit,
    onScanBarcode: () -> Unit,
    onDismiss: () -> Unit,
    onConfirm: (String, String, String?) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nuovo Prodotto") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = onCodeChange,
                    label = { Text("Codice *") },
                    placeholder = { Text("es. F-0-SP35-5") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = onNameChange,
                    label = { Text("Nome *") },
                    placeholder = { Text("es. FARINA 0 SP35 da 5 kg") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = barcode,
                    onValueChange = onBarcodeChange,
                    label = { Text("Codice a Barre") },
                    placeholder = { Text("es. 8001234567890") },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(onClick = onScanBarcode) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = "Scansiona")
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(code, name, barcode.ifBlank { null }) },
                enabled = code.isNotBlank() && name.isNotBlank()
            ) {
                Text("Crea")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annulla") }
        }
    )
}
