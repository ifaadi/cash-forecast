import ExcelJS from 'exceljs'

export async function generateCashFlowTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()

  // Set workbook properties
  workbook.creator = 'CFO Cash Command'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Create main worksheet
  const worksheet = workbook.addWorksheet('Cash Flow Forecast', {
    properties: { tabColor: { argb: 'FF4472C4' } },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
  })

  // Define columns with proper widths
  worksheet.columns = [
    { header: 'Week Number', key: 'weekNumber', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Inflow ($)', key: 'inflow', width: 18 },
    { header: 'Outflow ($)', key: 'outflow', width: 18 },
    { header: 'Net Cash Flow ($)', key: 'net', width: 20 },
    { header: 'Ending Balance ($)', key: 'balance', width: 20 },
    { header: 'Notes', key: 'notes', width: 35 },
  ]

  // Style the header row
  const headerRow = worksheet.getRow(1)
  headerRow.height = 30
  headerRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin' }
  }

  // Add instruction row
  const instructionRow = worksheet.insertRow(1, [
    'INSTRUCTIONS: Fill in your cash flow data below. Categories are validated. Inflows and Outflows must be positive numbers. Formula columns are auto-calculated.'
  ])
  instructionRow.height = 35
  instructionRow.font = { size: 11, italic: true, color: { argb: 'FF0070C0' } }
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDEEAF6' }
  }
  instructionRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  worksheet.mergeCells('A1:H1')

  // Add sample data rows with formulas
  const startDate = new Date()
  const categories = [
    'Revenue - Sales',
    'Revenue - Services',
    'Revenue - Other',
    'Expense - Payroll',
    'Expense - Rent',
    'Expense - Marketing',
    'Expense - Operations',
    'Expense - Other'
  ]

  // Add 13 weeks of template rows
  for (let week = 1; week <= 13; week++) {
    for (const category of categories) {
      const rowData = {
        weekNumber: week,
        date: new Date(startDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000),
        category: category,
        inflow: category.startsWith('Revenue') ? 0 : null,
        outflow: category.startsWith('Expense') ? 0 : null,
      }

      const row = worksheet.addRow(rowData)
      const rowIndex = row.number

      // Format date
      worksheet.getCell(`B${rowIndex}`).numFmt = 'mm/dd/yyyy'

      // Format currency columns
      worksheet.getCell(`D${rowIndex}`).numFmt = '$#,##0.00'
      worksheet.getCell(`E${rowIndex}`).numFmt = '$#,##0.00'
      worksheet.getCell(`F${rowIndex}`).numFmt = '$#,##0.00'
      worksheet.getCell(`G${rowIndex}`).numFmt = '$#,##0.00'

      // Add formulas for Net Cash Flow (Inflow - Outflow)
      worksheet.getCell(`F${rowIndex}`).value = {
        formula: `D${rowIndex}-E${rowIndex}`,
        result: 0
      }

      // Add formulas for Ending Balance (Previous Balance + Net)
      if (rowIndex > 3) {
        worksheet.getCell(`G${rowIndex}`).value = {
          formula: `G${rowIndex - 1}+F${rowIndex}`,
          result: 5000000
        }
      } else {
        worksheet.getCell(`G${rowIndex}`).value = 5000000 // Starting balance
      }

      // Alternate row coloring
      if (week % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          }
        })
      }

      // Add borders
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        }
      })

      // Conditional formatting for negative balances
      if (rowIndex > 2) {
        const balanceCell = worksheet.getCell(`G${rowIndex}`)
        balanceCell.font = { color: { argb: 'FF000000' } }
      }
    }
  }

  // Add data validation for Category column
  const lastRow = worksheet.rowCount
  worksheet.getColumn('C').eachCell({ includeEmpty: false }, (cell, rowNum) => {
    if (rowNum > 2) { // Skip instruction and header
      cell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${categories.join(',')}"`],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Category',
        error: 'Please select a category from the dropdown list.'
      }
    }
  })

  // Add data validation for Inflow and Outflow (must be positive numbers)
  for (let col of ['D', 'E']) {
    for (let row = 3; row <= lastRow; row++) {
      const cell = worksheet.getCell(`${col}${row}`)
      cell.dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        allowBlank: true,
        formulae: [0],
        errorStyle: 'error',
        errorTitle: 'Invalid Amount',
        error: 'Amount must be a positive number or zero.'
      }
    }
  }

  // Add Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary & Charts', {
    properties: { tabColor: { argb: 'FF70AD47' } }
  })

  summarySheet.mergeCells('A1:D1')
  const summaryTitle = summarySheet.getCell('A1')
  summaryTitle.value = 'Cash Flow Summary Dashboard'
  summaryTitle.font = { size: 16, bold: true, color: { argb: 'FF70AD47' } }
  summaryTitle.alignment = { vertical: 'middle', horizontal: 'center' }
  summaryTitle.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' }
  }

  summarySheet.getRow(1).height = 40

  // Add KPI cards in summary
  const kpis = [
    { label: 'Total Inflows', formula: '=SUM(\'Cash Flow Forecast\'!D:D)', color: 'FF70AD47' },
    { label: 'Total Outflows', formula: '=SUM(\'Cash Flow Forecast\'!E:E)', color: 'FFC00000' },
    { label: 'Net Cash Flow', formula: '=SUM(\'Cash Flow Forecast\'!F:F)', color: 'FF4472C4' },
    { label: 'Ending Balance', formula: '=INDIRECT("\'Cash Flow Forecast\'!G"&COUNTA(\'Cash Flow Forecast\'!G:G))', color: 'FF255E91' },
  ]

  let kpiRow = 3
  kpis.forEach(kpi => {
    summarySheet.getCell(`A${kpiRow}`).value = kpi.label
    summarySheet.getCell(`A${kpiRow}`).font = { size: 12, bold: true }
    summarySheet.getCell(`A${kpiRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: kpi.color }
    }
    summarySheet.getCell(`A${kpiRow}`).font.color = { argb: 'FFFFFFFF' }
    summarySheet.getCell(`A${kpiRow}`).alignment = { horizontal: 'center', vertical: 'middle' }

    summarySheet.getCell(`B${kpiRow}`).value = { formula: kpi.formula }
    summarySheet.getCell(`B${kpiRow}`).numFmt = '$#,##0.00'
    summarySheet.getCell(`B${kpiRow}`).font = { size: 14, bold: true }
    summarySheet.getCell(`B${kpiRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

    summarySheet.getRow(kpiRow).height = 30
    kpiRow += 2
  })

  summarySheet.getColumn('A').width = 25
  summarySheet.getColumn('B').width = 25

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadTemplate() {
  generateCashFlowTemplate().then(blob => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Cash_Flow_Template_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  })
}
