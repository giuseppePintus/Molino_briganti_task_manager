package com.molinobriganti.inventory.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.molinobriganti.inventory.data.local.TokenManager
import com.molinobriganti.inventory.ui.screens.*
import com.molinobriganti.inventory.viewmodel.*

@Composable
fun AppNavGraph(
    tokenManager: TokenManager
) {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.uiState.collectAsStateWithLifecycle()

    val serverUrl by tokenManager.serverUrl.collectAsStateWithLifecycle(initialValue = "")
    val serverUrlHistory by tokenManager.serverUrlHistory.collectAsStateWithLifecycle(initialValue = emptyList())

    // Company logo
    val companyViewModel: CompanyViewModel = hiltViewModel()
    val logoUrl by companyViewModel.logoUrl.collectAsStateWithLifecycle()
    val baseUrl = (serverUrl ?: "http://NAS71F89C:5000").trimEnd('/')
    val fullLogoUrl = if (logoUrl != null) "$baseUrl/$logoUrl" else null

    // Avatar (profile picture)
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val avatarUrl by profileViewModel.avatarUrl.collectAsStateWithLifecycle()
    val fullAvatarUrl = if (avatarUrl != null) "$baseUrl/$avatarUrl" else null

    // Shelf positions (shared across screens)
    val shelfPositionViewModel: ShelfPositionViewModel = hiltViewModel()
    val shelfPositionState by shelfPositionViewModel.uiState.collectAsStateWithLifecycle()

    // If not logged in, show login
    if (!authState.isLoggedIn) {
        LoginScreen(
            uiState = authState,
            currentServerUrl = serverUrl ?: "",
            serverUrlHistory = serverUrlHistory,
            logoUrl = fullLogoUrl,
            onLogin = authViewModel::login,
            onClearError = authViewModel::clearError,
            onRemoveServerUrl = authViewModel::removeServerUrlFromHistory
        )
        return
    }

    // Reload shelf positions every time the app comes back to foreground
    val appLifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(appLifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) shelfPositionViewModel.loadPositions()
        }
        appLifecycleOwner.lifecycle.addObserver(obs)
        onDispose { appLifecycleOwner.lifecycle.removeObserver(obs) }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val showBottomBar = bottomNavItems.any { screen ->
        currentDestination?.hierarchy?.any { it.route == screen.route } == true
    }

    com.molinobriganti.inventory.ui.components.ProvideCompanyLogo(fullLogoUrl) {
    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                // Polling leggero per il count avvisi (badge rosso sull'icona Avvisi)
                var alertCount by remember { mutableStateOf(0) }
                var alertTotal by remember { mutableStateOf(0) }
                var alertCritical by remember { mutableStateOf(false) }
                val ctx = LocalContext.current
                val baseUrlForAlerts = baseUrl
                LaunchedEffect(baseUrlForAlerts) {
                    if (baseUrlForAlerts.isBlank()) return@LaunchedEffect
                    val normalizedBase = if (
                        baseUrlForAlerts.startsWith("http://") ||
                        baseUrlForAlerts.startsWith("https://")
                    ) baseUrlForAlerts else "http://$baseUrlForAlerts"
                    while (true) {
                        try {
                            val txt = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                                val url = java.net.URL("$normalizedBase/api/alerts")
                                val conn = url.openConnection() as java.net.HttpURLConnection
                                conn.connectTimeout = 4000; conn.readTimeout = 4000
                                try {
                                    conn.inputStream.bufferedReader().use { it.readText() }
                                } finally {
                                    conn.disconnect()
                                }
                            }
                            val cMatch = Regex("\"count\"\\s*:\\s*(\\d+)").find(txt)
                            val tMatch = Regex("\"total\"\\s*:\\s*(\\d+)").find(txt)
                            alertCount = cMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0
                            alertTotal = tMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0
                            alertCritical = txt.contains("\"level\":\"CRITICAL\"")
                        } catch (e: Exception) {
                            android.util.Log.w("AlertsPolling", "fetch failed: ${e.message}")
                        }
                        kotlinx.coroutines.delay(15_000)
                    }
                }
                NavigationBar {
                    bottomNavItems.forEach { screen ->
                        val isAlerts = screen.route == Screen.Alerts.route
                        // Verde = nessun avviso, Arancione = solo snoozed (no badge), Rosso = avvisi attivi
                        val isUrgent = isAlerts && alertCount > 0
                        val isSnoozed = isAlerts && alertCount == 0 && alertTotal > 0
                        val isOk = isAlerts && alertTotal == 0
                        val tintColor = when {
                            isUrgent -> Color(0xFFDC2626)   // rosso
                            isSnoozed -> Color(0xFFEA580C)  // arancione (solo icona)
                            isOk -> Color(0xFF16A34A)       // verde
                            else -> Color.Unspecified
                        }
                        // Badge solo per avvisi attivi (non per ordini in corso)
                        val showBadge = isUrgent
                        NavigationBarItem(
                            icon = {
                                screen.icon?.let { ic ->
                                    if (showBadge) {
                                        BadgedBox(badge = {
                                            Badge(
                                                containerColor = tintColor,
                                                contentColor = Color.White
                                            ) { Text((if (isUrgent) alertCount else alertTotal).toString()) }
                                        }) {
                                            Icon(
                                                ic,
                                                contentDescription = screen.title,
                                                tint = tintColor
                                            )
                                        }
                                    } else {
                                        Icon(ic, contentDescription = screen.title, tint = tintColor)
                                    }
                                }
                            },
                            label = {
                                Text(
                                    screen.title,
                                    color = if (isAlerts) tintColor else Color.Unspecified
                                )
                            },
                            selected = currentDestination?.hierarchy?.any {
                                it.route == screen.route
                            } == true,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Articles.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Articles list
            composable(Screen.Articles.route) {
                val viewModel: ArticleViewModel = hiltViewModel()
                val uiState by viewModel.uiState.collectAsStateWithLifecycle()
                val articlesShelfEntryViewModel: ShelfEntryViewModel = hiltViewModel()
                val articlesShelfEntryState by articlesShelfEntryViewModel.uiState.collectAsStateWithLifecycle()

                val articlesLifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(articlesLifecycleOwner) {
                    val obs = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            viewModel.loadArticles()
                            articlesShelfEntryViewModel.loadEntries()
                        }
                    }
                    articlesLifecycleOwner.lifecycle.addObserver(obs)
                    onDispose { articlesLifecycleOwner.lifecycle.removeObserver(obs) }
                }

                ArticleListScreen(
                    uiState = uiState,
                    shelfEntries = articlesShelfEntryState.entries,
                    logoUrl = fullLogoUrl,
                    onSearchChanged = viewModel::onSearchQueryChanged,
                    onCategorySelected = viewModel::onCategorySelected,
                    onArticleClick = { article ->
                        navController.navigate(Screen.ArticleDetail.createRoute(article.id))
                    },
                    onRefresh = viewModel::loadArticles,
                    onCreateNew = {
                        navController.navigate(Screen.ArticleCreate.route)
                    }
                )
            }

            // Article detail
            composable(
                route = Screen.ArticleDetail.route,
                arguments = listOf(navArgument("articleId") { type = NavType.IntType })
            ) { backStackEntry ->
                val articleId = backStackEntry.arguments?.getInt("articleId") ?: return@composable
                val viewModel: ArticleViewModel = hiltViewModel()
                val uiState by viewModel.uiState.collectAsStateWithLifecycle()
                val shelfEntryViewModel: ShelfEntryViewModel = hiltViewModel()
                val shelfEntryState by shelfEntryViewModel.uiState.collectAsStateWithLifecycle()

                val articleDetailLifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(articleDetailLifecycleOwner) {
                    val obs = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            viewModel.loadArticles()
                            shelfEntryViewModel.loadEntries()
                        }
                    }
                    articleDetailLifecycleOwner.lifecycle.addObserver(obs)
                    onDispose { articleDetailLifecycleOwner.lifecycle.removeObserver(obs) }
                }

                val article = uiState.articles.find { it.id == articleId }
                if (article != null) {
                    ArticleDetailScreen(
                        article = article,
                        shelfPositions = shelfPositionState.positions,
                        shelfEntries = shelfEntryState.entries.filter { it.articleId == articleId },
                        onBack = { navController.popBackStack() },
                        onUpdateStock = viewModel::updateStock,
                        onUpdatePosition = viewModel::updateShelfPosition,
                        onCreateEntry = { positionCode, quantity, batch, expiry, notes ->
                            shelfEntryViewModel.createEntry(articleId, positionCode, quantity, batch, expiry, notes)
                        },
                        onUpdateEntry = { id, quantity, batch, expiry, notes ->
                            shelfEntryViewModel.updateEntry(id, quantity, batch, expiry, notes)
                        },
                        onDeleteEntry = shelfEntryViewModel::deleteEntry,
                        onEdit = { art ->
                            navController.navigate(Screen.ArticleEdit.createRoute(art.id))
                        },
                        onDelete = { id ->
                            viewModel.deleteArticle(id)
                            navController.popBackStack()
                        }
                    )
                }
            }

            // Article create
            composable(Screen.ArticleCreate.route) {
                val viewModel: ArticleViewModel = hiltViewModel()
                val uiState by viewModel.uiState.collectAsStateWithLifecycle()

                LaunchedEffect(uiState.operationSuccess) {
                    if (uiState.operationSuccess != null) {
                        viewModel.clearSuccess()
                        navController.popBackStack()
                    }
                }

                ArticleEditScreen(
                    article = null,
                    isLoading = uiState.isLoading,
                    knownCategories = uiState.categories,
                    onBack = { navController.popBackStack() },
                    onSave = { code, name, description, category, unit, weightPerUnit, barcode, minStock, critStock ->
                        viewModel.createArticle(code, name, description, category, unit, weightPerUnit, barcode, minStock, critStock)
                    }
                )
            }

            // Article edit
            composable(
                route = Screen.ArticleEdit.route,
                arguments = listOf(navArgument("articleId") { type = NavType.IntType })
            ) { backStackEntry ->
                val articleId = backStackEntry.arguments?.getInt("articleId") ?: return@composable
                val viewModel: ArticleViewModel = hiltViewModel()
                val uiState by viewModel.uiState.collectAsStateWithLifecycle()

                val article = uiState.articles.find { it.id == articleId }

                LaunchedEffect(uiState.operationSuccess) {
                    if (uiState.operationSuccess != null) {
                        viewModel.clearSuccess()
                        navController.popBackStack()
                    }
                }

                if (article != null) {
                    ArticleEditScreen(
                        article = article,
                        isLoading = uiState.isLoading,
                        knownCategories = uiState.categories,
                        onBack = { navController.popBackStack() },
                    onSave = { code, name, description, category, unit, weightPerUnit, barcode, minStock, critStock ->
                        viewModel.updateArticle(article.id, code, name, description, category, unit, weightPerUnit, barcode, minStock, critStock)
                        }
                    )
                }
            }

            // Load Merce (carico)
            composable(Screen.LoadMerce.route) {
                val loadViewModel: LoadMerceViewModel = hiltViewModel()
                val articleViewModel: ArticleViewModel = hiltViewModel()
                val loadState by loadViewModel.uiState.collectAsStateWithLifecycle()
                val articleState by articleViewModel.uiState.collectAsStateWithLifecycle()

                // Find matching article when product is scanned
                LaunchedEffect(loadState.productBarcode) {
                    if (loadState.productBarcode.isNotBlank()) {
                        val matched = articleState.articles.find {
                            it.code == loadState.productBarcode
                        }
                        loadViewModel.onArticleMatched(matched)
                    }
                }

                LoadMerceScreen(
                    state = loadState,
                    articles = articleState.articles,
                    shelfPositions = shelfPositionState.positions,
                    onShelfScanned = loadViewModel::onShelfScanned,
                    onProductScanned = loadViewModel::onProductScanned,
                    onQuantityChanged = loadViewModel::onQuantityChanged,
                    onBatchChanged = loadViewModel::onBatchChanged,
                    onExpiryChanged = loadViewModel::onExpiryChanged,
                    onNotesChanged = loadViewModel::onNotesChanged,
                    onGoToConfirm = loadViewModel::goToConfirm,
                    onGoBack = loadViewModel::goBack,
                    onSave = {
                        loadViewModel.onSaveStarted()
                        // The actual save via API
                        val article = loadState.matchedArticle
                        if (article != null) {
                            val currentStock = article.inventory?.currentStock ?: 0
                            val addQty = loadState.quantity.toIntOrNull() ?: 0
                            articleViewModel.updateStock(
                                article.id,
                                currentStock + addQty,
                                "Carico merce - Lotto: ${loadState.batch}"
                            )
                            articleViewModel.updateShelfPosition(
                                article.id,
                                loadState.shelfBarcode
                            )
                            loadViewModel.onSaveComplete()
                        } else {
                            loadViewModel.onSaveError("Articolo non trovato nel database")
                        }
                    },
                    onReset = loadViewModel::reset,
                    onBack = { /* Already on bottom nav */ }
                )
            }

            // Alerts
            composable(Screen.Alerts.route) {
                val viewModel: AlertViewModel = hiltViewModel()
                val uiState by viewModel.uiState.collectAsStateWithLifecycle()

                val alertsLifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(alertsLifecycleOwner) {
                    val obs = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) viewModel.loadAlerts()
                    }
                    alertsLifecycleOwner.lifecycle.addObserver(obs)
                    onDispose { alertsLifecycleOwner.lifecycle.removeObserver(obs) }
                }

                AlertsScreen(
                    uiState = uiState,
                    onRefresh = viewModel::loadAlerts,
                    onCreateOrder = viewModel::createOrderTask,
                    onDismissRestock = viewModel::dismissRestock,
                    onUnsnooze = viewModel::unsnoozeAlert,
                    onClearToast = viewModel::clearToast,
                    onClearError = viewModel::clearError
                )
            }

            // Settings
            composable(Screen.Settings.route) {
                val articleViewModel: ArticleViewModel = hiltViewModel()
                val articleState by articleViewModel.uiState.collectAsStateWithLifecycle()
                val context = LocalContext.current

                SettingsScreen(
                    currentServerUrl = serverUrl ?: "http://NAS71F89C:5000",
                    username = authState.username,
                    avatarUrl = fullAvatarUrl,
                    shelfPositions = shelfPositionState.positions,
                    articles = articleState.articles,
                    onServerUrlChanged = authViewModel::updateServerUrl,
                    onCreatePosition = shelfPositionViewModel::createPosition,
                    onDeletePosition = shelfPositionViewModel::deletePosition,
                    onEditArticle = { art ->
                        navController.navigate(Screen.ArticleEdit.createRoute(art.id))
                    },
                    onDeleteArticle = articleViewModel::deleteArticle,
                    onCreateArticle = { code, name, barcode ->
                        articleViewModel.createArticle(code, name, null, null, "pz", 1f, barcode)
                    },
                    onAvatarPicked = { uri ->
                        profileViewModel.uploadAvatar(uri, context)
                    },
                    onLogout = authViewModel::logout
                )
            }

            // Shelf Map
            composable(Screen.ShelfMap.route) {
                val articleViewModel: ArticleViewModel = hiltViewModel()
                val articleState by articleViewModel.uiState.collectAsStateWithLifecycle()
                val shelfEntryViewModel: ShelfEntryViewModel = hiltViewModel()
                val shelfEntryState by shelfEntryViewModel.uiState.collectAsStateWithLifecycle()

                val shelfMapLifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(shelfMapLifecycleOwner) {
                    val obs = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            articleViewModel.loadArticles()
                            shelfEntryViewModel.loadEntries()
                        }
                    }
                    shelfMapLifecycleOwner.lifecycle.addObserver(obs)
                    onDispose { shelfMapLifecycleOwner.lifecycle.removeObserver(obs) }
                }

                ShelfMapScreen(
                    shelfPositions = shelfPositionState.positions,
                    articles = articleState.articles,
                    shelfEntries = shelfEntryState.entries,
                    isLoading = articleState.isLoading || shelfPositionState.isLoading || shelfEntryState.isLoading,
                    onBack = { navController.popBackStack() },
                    onPrint = { navController.navigate(Screen.PrintInventory.route) },
                    onCreateEntry = { articleId, positionCode, quantity, batch, expiry ->
                        shelfEntryViewModel.createEntry(articleId, positionCode, quantity, batch, expiry)
                    },
                    onUpdateEntry = { id, quantity, batch, expiry ->
                        shelfEntryViewModel.updateEntry(id, quantity, batch, expiry)
                    },
                    onDeleteEntry = { id ->
                        shelfEntryViewModel.deleteEntry(id)
                    },
                    onMoveEntry = { id, newPositionCode ->
                        shelfEntryViewModel.moveEntry(id, newPositionCode)
                    },
                    onCopyEntry = { articleId, positionCode, quantity, batch, expiry ->
                        shelfEntryViewModel.createEntry(articleId, positionCode, quantity, batch, expiry)
                    }
                )
            }

            composable(Screen.PrintInventory.route) {
                val articleViewModel: ArticleViewModel = hiltViewModel()
                val articleState by articleViewModel.uiState.collectAsStateWithLifecycle()
                val shelfEntryViewModel: ShelfEntryViewModel = hiltViewModel()
                val shelfEntryState by shelfEntryViewModel.uiState.collectAsStateWithLifecycle()
                PrintInventoryScreen(
                    shelfPositions = shelfPositionState.positions,
                    articles = articleState.articles,
                    shelfEntries = shelfEntryState.entries,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
    }
}
