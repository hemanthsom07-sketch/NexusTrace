import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_DIR = 'C:\\Users\\USER\\OneDrive\\Desktop\\NexusTrace\\audit_screenshots'

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runAudit() {
  console.log('Launching headless Chrome via puppeteer-core...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  const consoleErrors = []
  const pageErrors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
      console.log(`[Browser Console Error] ${msg.text()}`)
    }
  })

  page.on('pageerror', (err) => {
    pageErrors.push(err.toString())
    console.log(`[Browser Page Error] ${err.toString()}`)
  })

  try {
    console.log('\n--- 1. Testing Dashboard Page ---')
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1500))

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dashboard.png') })
    console.log('✓ Captured 01_dashboard.png')

    // Inspect KPI values
    const kpiValues = await page.$$eval('.kpi-card', (cards) =>
      cards.map((c) => ({
        label: c.querySelector('.kpi-label')?.innerText,
        value: c.querySelector('.kpi-value')?.innerText,
        sub: c.querySelector('.kpi-sub')?.innerText,
      }))
    )
    console.log('KPI Cards found:', kpiValues)

    console.log('\n--- 2. Testing Investigate View ---')
    // Click on Investigate Tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const invBtn = btns.find((b) => b.innerText.includes('Investigate'))
      if (invBtn) invBtn.click()
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_investigate.png') })
    console.log('✓ Captured 02_investigate.png')

    // Check leads list items
    const leadItemsCount = await page.$$eval('.lead-item', (items) => items.length)
    console.log(`Leads List Items rendered: ${leadItemsCount}`)

    // Check if W_A12 is selected and inspector is populated
    const inspectorTitle = await page.$eval('.entity-title', (el) => el.innerText).catch(() => 'NOT_FOUND')
    const inspectorScore = await page.$eval('.big-score', (el) => el.innerText).catch(() => 'NOT_FOUND')
    console.log(`Inspector Target: ${inspectorTitle}, Score: ${inspectorScore}`)

    // Check graph presence
    const canvasExists = await page.$eval('.graph-canvas-container canvas', (el) => !!el).catch(() => false)
    console.log(`Graph Canvas active: ${canvasExists}`)

    // Test 3D Toggle
    console.log('Testing 2D -> 3D Spatial switch...')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.mode-btn'))
      const btn3D = btns.find((b) => b.innerText.includes('3D'))
      if (btn3D) btn3D.click()
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02b_investigate_3d.png') })
    console.log('✓ Captured 02b_investigate_3d.png')

    // Switch back to 2D
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.mode-btn'))
      const btn2D = btns.find((b) => b.innerText.includes('2D'))
      if (btn2D) btn2D.click()
    })
    await new Promise((r) => setTimeout(r, 1000))

    // Test Clicking on a Related TX Chip (e.g. TX2001)
    console.log('Testing click on Related TX chip...')
    const clickedChip = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.evidence-chip'))
      const txChip = chips.find((c) => c.innerText.includes('TX2001'))
      if (txChip) {
        txChip.click()
        return true
      }
      return false
    })
    await new Promise((r) => setTimeout(r, 1500))
    const inspectorAfterTxClick = await page.$eval('.entity-title', (el) => el.innerText).catch(() => 'NOT_FOUND')
    console.log(`Clicked TX chip: ${clickedChip}, Inspector now displays: ${inspectorAfterTxClick}`)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02c_investigate_tx_selected.png') })
    console.log('✓ Captured 02c_investigate_tx_selected.png')

    // Test Clicking on an IP Chip (e.g. 45.33.1.10)
    console.log('Testing click on Related IP chip...')
    // Select W_A12 first to get its IP chips
    await page.evaluate(() => {
      const leads = Array.from(document.querySelectorAll('.lead-item'))
      const wa12 = leads.find((l) => l.innerText.includes('W_A12'))
      if (wa12) wa12.click()
    })
    await new Promise((r) => setTimeout(r, 1000))

    const clickedIpChip = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.evidence-chip.ip'))
      if (chips[0]) {
        chips[0].click()
        return chips[0].innerText
      }
      return null
    })
    await new Promise((r) => setTimeout(r, 1500))
    const inspectorAfterIpClick = await page.$eval('.entity-title', (el) => el.innerText).catch(() => 'NOT_FOUND')
    console.log(`Clicked IP chip: ${clickedIpChip}, Inspector now displays: ${inspectorAfterIpClick}`)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02d_investigate_ip_selected.png') })
    console.log('✓ Captured 02d_investigate_ip_selected.png')

    console.log('\n--- 3. Testing Transactions Tab ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const txBtn = btns.find((b) => b.innerText.includes('Transactions'))
      if (txBtn) txBtn.click()
    })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_transactions.png') })
    console.log('✓ Captured 03_transactions.png')

    const txRowCount = await page.$$eval('.data-table tbody tr', (rows) => rows.length)
    console.log(`Transactions table rows rendered: ${txRowCount}`)

    console.log('\n--- 4. Testing Network Graph Tab (Full Screen) ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const gBtn = btns.find((b) => b.innerText.includes('Network Graph'))
      if (gBtn) gBtn.click()
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_network_graph.png') })
    console.log('✓ Captured 04_network_graph.png')

    console.log('\n--- 5. Testing Alerts Tab ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const alertBtn = btns.find((b) => b.innerText.includes('Alerts'))
      if (alertBtn) alertBtn.click()
    })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_alerts.png') })
    console.log('✓ Captured 05_alerts.png')

    const alertsCount = await page.$$eval('.data-table tbody tr', (rows) => rows.length)
    console.log(`Alerts queue rows rendered: ${alertsCount}`)

    console.log('\n--- 6. Testing Data / Pipeline Tab ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const pipeBtn = btns.find((b) => b.innerText.includes('Pipeline'))
      if (pipeBtn) pipeBtn.click()
    })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_pipeline.png') })
    console.log('✓ Captured 06_pipeline.png')

    // Test Search / Filter in Leads
    console.log('\n--- 7. Testing Search and Filter UX ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const invBtn = btns.find((b) => b.innerText.includes('Investigate'))
      if (invBtn) invBtn.click()
    })
    await new Promise((r) => setTimeout(r, 1000))

    // Search for TX2001 in leads table
    await page.type('.search-input', 'TX2001')
    await new Promise((r) => setTimeout(r, 600))
    const searchMatchCount = await page.$$eval('.lead-item', (items) => items.length)
    console.log(`Search for 'TX2001' matched leads: ${searchMatchCount}`)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_search_tx2001.png') })

    // Clear search
    await page.evaluate(() => {
      const input = document.querySelector('.search-input')
      if (input) {
        input.value = ''
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await new Promise((r) => setTimeout(r, 400))

    // Filter by HIGH severity
    await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.filter-pill'))
      const highPill = pills.find((p) => p.innerText.includes('HIGH'))
      if (highPill) highPill.click()
    })
    await new Promise((r) => setTimeout(r, 600))
    const highMatchCount = await page.$$eval('.lead-item', (items) => items.length)
    console.log(`Filter by 'HIGH' matched leads: ${highMatchCount}`)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_filter_high.png') })

    console.log('\n--- 8. Testing Pipeline Execution in Data Tab ---')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.nav-tab-btn'))
      const pipeBtn = btns.find((b) => b.innerText.includes('Pipeline'))
      if (pipeBtn) pipeBtn.click()
    })
    await new Promise((r) => setTimeout(r, 1000))

    // Click "Execute Against Default Sample Dataset" button
    console.log('Clicking "Execute Against Default Sample Dataset"...')
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const runBtn = btns.find((b) => b.innerText.includes('Execute Against Default Sample Dataset'))
      if (runBtn) runBtn.click()
    })
    // Wait for pipeline execution to complete
    await new Promise((r) => setTimeout(r, 3500))
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_pipeline_executed.png') })
    console.log('✓ Captured 09_pipeline_executed.png')

    console.log('\n--- Audit Finished Successfully! ---')
    console.log(`Total Console Errors: ${consoleErrors.length}`)
    console.log(`Total Page Errors: ${pageErrors.length}`)
  } catch (err) {
    console.error('Audit encountered an exception:', err)
  } finally {
    await browser.close()
  }
}

runAudit()
