package com.molinobriganti.inventory.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector? = null
) {
    data object Login : Screen("login", "Login")
    data object Articles : Screen("articles", "Articoli", Icons.Default.Inventory2)
    data object ArticleDetail : Screen("article/{articleId}", "Dettaglio") {
        fun createRoute(articleId: Int) = "article/$articleId"
    }
    data object ArticleCreate : Screen("article/new", "Nuovo Articolo")
    data object ArticleEdit : Screen("article/{articleId}/edit", "Modifica Articolo") {
        fun createRoute(articleId: Int) = "article/$articleId/edit"
    }
    data object LoadMerce : Screen("load_merce", "Carico")
    data object Alerts : Screen("alerts", "Avvisi", Icons.Default.NotificationsActive)
    data object Settings : Screen("settings", "Impostazioni", Icons.Default.Settings)
    data object ShelfMap : Screen("shelf_map", "Scaffali", Icons.Default.ViewModule)
    data object PrintInventory : Screen("print_inventory", "Stampa Inventario")
}

val bottomNavItems = listOf(
    Screen.Articles,
    Screen.ShelfMap,
    Screen.Alerts,
    Screen.Settings
)
