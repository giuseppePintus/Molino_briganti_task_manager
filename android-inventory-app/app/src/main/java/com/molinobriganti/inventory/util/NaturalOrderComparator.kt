package com.molinobriganti.inventory.util

/**
 * Comparator that sorts strings in natural order:
 * B1, B2, B3, ..., B10, B11 instead of B1, B10, B11, B2, B3.
 */
object NaturalOrderComparator : Comparator<String> {

    private val SPLIT_PATTERN = Regex("(\\d+|\\D+)")

    override fun compare(a: String?, b: String?): Int {
        if (a == null && b == null) return 0
        if (a == null) return -1
        if (b == null) return 1

        val partsA = SPLIT_PATTERN.findAll(a).map { it.value }.toList()
        val partsB = SPLIT_PATTERN.findAll(b).map { it.value }.toList()

        for (i in 0 until minOf(partsA.size, partsB.size)) {
            val partA = partsA[i]
            val partB = partsB[i]

            val numA = partA.toLongOrNull()
            val numB = partB.toLongOrNull()

            val cmp = if (numA != null && numB != null) {
                numA.compareTo(numB)
            } else {
                partA.compareTo(partB, ignoreCase = true)
            }

            if (cmp != 0) return cmp
        }

        return partsA.size - partsB.size
    }
}
