// Demo Store (demo.honebi.online) E2E pipeline.
//
// Required Jenkins plugins:
//   - Pipeline (workflow-aggregator)
//   - Docker Pipeline        -> runs the build inside the official Playwright image
//   - JUnit                  -> test trend and per-test results in the build page
//   - HTML Publisher         -> "Allure Report" and "Playwright Report" links on the build page
//   - Timestamper            -> timestamps() in console output
// Optional:
//   - Allure Jenkins Plugin  -> native Allure trend graphs. It uses the Allure 2 commandline, configured
//                               under Manage Jenkins > Tools > Allure Commandline (name it "allure").
//                               Allure 2 reads the same allure-results directory this project produces.
//
// The image tag must match the @playwright/test version pinned in package.json, so Firefox and WebKit are
// preinstalled; Google Chrome (the default browser) is installed by the pipeline.

pipeline {
  agent {
    docker {
      image 'mcr.microsoft.com/playwright:v1.64.1-noble'
      args '--ipc=host -u root'
    }
  }

  parameters {
    choice(name: 'SUITE', choices: ['all', 'smoke', 'regression'], description: 'Which test suite to run')
  }

  environment {
    CI = 'true'
    HOME = "${env.WORKSPACE}"
    NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm"
    // Optional overrides (see .env.example), e.g. a different delivery pincode:
    // DEMO_PINCODE = '560001'
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install dependencies') {
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
      }
    }

    stage('Install Playwright browsers') {
      steps {
        // Google Chrome is the default browser. Unlike Playwright's own engines it is not in the image and
        // installs system-wide, hence `-u root` on the agent above.
        sh 'npx playwright install --with-deps chrome'
      }
    }

    stage('Type check') {
      steps {
        sh 'npm run typecheck'
      }
    }

    stage('Run tests') {
      steps {
        script {
          def command = [all: 'npm test', smoke: 'npm run test:smoke', regression: 'npm run test:regression'][params.SUITE]
          // Mark the build UNSTABLE on test failures instead of aborting, so reports are still published.
          def exitCode = sh(script: command, returnStatus: true)
          if (exitCode != 0) {
            unstable("Tests failed with exit code ${exitCode}")
          }
        }
      }
    }
  }

  post {
    always {
      sh 'npm run allure:generate || echo "Allure report generation failed"'

      junit allowEmptyResults: true, testResults: 'test-results/junit.xml'

      archiveArtifacts allowEmptyArchive: true, artifacts: 'allure-results/**, allure-report/**, playwright-report/**, test-results/**'

      publishHTML(target: [
        reportName: 'Allure Report',
        reportDir: 'allure-report',
        reportFiles: 'index.html',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true,
      ])
      publishHTML(target: [
        reportName: 'Playwright Report',
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true,
      ])

      // Uncomment when the Allure Jenkins Plugin and "allure" commandline tool are configured:
      // allure includeProperties: false, results: [[path: 'allure-results']]
    }
  }
}
