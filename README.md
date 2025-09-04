# Prompt-Hub

Prompt-Hub is a centralized place to create, manage, and share prompts for AI models. It helps you build complex prompts, organize them, and collaborate with others.

## Project Structure

This is a Kotlin Multiplatform project targeting both Web and Server.

* **[/server](./server/src/main/kotlin)** - Ktor server application.
* **[/shared](./shared/src)** - Shared code between all targets.

  * **[commonMain](./shared/src/commonMain/kotlin)** - Shared logic for all platforms.
  * Platform-specific folders for additional code.

## Build and Run

### Run Server

To build and run the development version of the server:

**macOS/Linux:**

```bash
./gradlew :server:run
```

**Windows:**

```bash
.\gradlew.bat :server:run
```

---

### Run Web Application

1. Install [Node.js](https://nodejs.org/en/download) (includes `npm`)

2. Build Kotlin/JS shared code:

   **macOS/Linux:**

   ```bash
   ./gradlew :shared:jsBrowserDevelopmentLibraryDistribution
   ```

   **Windows:**

   ```bash
   .\gradlew.bat :shared:jsBrowserDevelopmentLibraryDistribution
   ```

3. Build and run the web app:

   ```bash
   npm install
   npm run start
   ```

---

## Demo

Here a Demo ScreenShot 

<img width="1366" height="656" alt="image" src="https://github.com/user-attachments/assets/646a6744-f1d4-4ccf-ab5b-2ace657a62d3" />


---

Learn more about [Kotlin Multiplatform](https://www.jetbrains.com/help/kotlin-multiplatform-dev/get-started.html).
