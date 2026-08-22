package com.molinobriganti.inventory

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.molinobriganti.inventory.data.local.TokenManager
import com.molinobriganti.inventory.ui.navigation.AppNavGraph
import com.molinobriganti.inventory.ui.theme.MolinoInventoryTheme
import com.molinobriganti.inventory.util.AdbTcpEnabler
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AdbTcpEnabler.enable() // Mantiene ADB TCP attivo al riavvio (Jelly Bean 4.2.2, root)
        enableEdgeToEdge()

        setContent {
            MolinoInventoryTheme {
                AppNavGraph(tokenManager = tokenManager)
            }
        }
    }
}
