package com.molinobriganti.inventory.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.molinobriganti.inventory.R

/**
 * Composition-local that exposes the company logo URL to the entire UI tree.
 * Set it once in AppNavGraph; every screen can read it without parameter passing.
 */
val LocalCompanyLogoUrl = compositionLocalOf<String?> { null }

@Composable
fun ProvideCompanyLogo(logoUrl: String?, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalCompanyLogoUrl provides logoUrl) {
        content()
    }
}

/**
 * Small circular company logo intended for use as the leading element inside a
 * TopAppBar `title` slot (top-left position). Falls back to the bundled
 * `molino_logo` drawable when no URL is available.
 */
@Composable
fun TopBarCompanyLogo(
    logoUrl: String? = LocalCompanyLogoUrl.current,
    size: Int = 72
) {
    val mod = Modifier
        .padding(end = 10.dp)
        .requiredSize(size.dp)
        .clip(CircleShape)
    val fallback = painterResource(id = R.drawable.molino_logo)
    if (!logoUrl.isNullOrBlank()) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(logoUrl)
                .crossfade(true)
                .build(),
            contentDescription = "Logo aziendale",
            contentScale = ContentScale.Fit,
            placeholder = fallback,
            error = fallback,
            fallback = fallback,
            modifier = mod
        )
    } else {
        Image(
            painter = fallback,
            contentDescription = "Logo aziendale",
            contentScale = ContentScale.Fit,
            modifier = mod
        )
    }
}
