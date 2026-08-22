package com.molinobriganti.inventory

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.molinobriganti.inventory.util.AdbTcpEnabler

/**
 * Riattiva ADB over TCP/IP a ogni riavvio del dispositivo.
 * Su Android 4.2.2 (Jelly Bean) il flag non persiste senza root.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            AdbTcpEnabler.enable()
        }
    }
}
