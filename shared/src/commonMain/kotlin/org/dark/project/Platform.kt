package org.dark.project

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform