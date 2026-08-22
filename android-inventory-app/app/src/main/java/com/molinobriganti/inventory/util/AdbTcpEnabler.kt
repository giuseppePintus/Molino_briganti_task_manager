package com.molinobriganti.inventory.util

import android.util.Log

/**
 * Abilita ADB over TCP/IP tramite root shell.
 * Necessario su Jelly Bean 4.2.2 dove il flag non persiste ai riavvii.
 * Silenzioso se il dispositivo non è rooted.
 */
object AdbTcpEnabler {

    private const val TAG = "AdbTcpEnabler"
    private const val PORT = 5555

    fun enable() {
        Thread {
            try {
                val proc = Runtime.getRuntime().exec("su")
                proc.outputStream.bufferedWriter().use { w ->
                    // persist.* sopravvive ai reboot; service.* attiva subito questa sessione
                    w.write("setprop persist.adb.tcp.port $PORT\n")
                    w.write("setprop service.adb.tcp.port $PORT\n")
                    w.write("stop adbd\n")
                    w.write("start adbd\n")
                    w.write("exit\n")
                }
                val exitCode = proc.waitFor()
                Log.i(TAG, "ADB TCP porta $PORT attivata (exit=$exitCode)")
            } catch (e: Exception) {
                Log.w(TAG, "ADB TCP: impossibile attivare (root assente?): ${e.message}")
            }
        }.start()
    }
}
