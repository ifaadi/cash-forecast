'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Pencil, Plus, Download, Upload, ArrowLeft, FileSpreadsheet, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { downloadTemplate } from '@/lib/excel-template'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface Transaction {
  id: string
  company_id: string
  transaction_date: string
  category: string
  type: 'Inflow' | 'Outflow'
  amount: number
  description: string | null
  is_recurring: boolean
  created_at: string
}

const CATEGORIES = [
  'Sales Revenue',
  'Service Revenue',
  'Loan Proceeds',
  'Investment',
  'Payroll',
  'Rent',
  'Utilities',
  'Marketing',
  'Equipment',
  'Supplies',
  'Professional Fees',
  'Taxes',
  'Loan Repayment',
  'Other',
]

export default function TransactionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'Inflow' | 'Outflow'>('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    category: 'Sales Revenue',
    type: 'Inflow' as 'Inflow' | 'Outflow',
    amount: '',
    description: '',
    is_recurring: false,
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (companyId) {
      loadTransactions()
    }
  }, [companyId])

  useEffect(() => {
    applyFilters()
  }, [transactions, searchTerm, filterType, filterCategory, startDate, endDate])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)

    // Get user's company_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
    setLoading(false)
  }

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })

    if (error) {
      console.error('Error loading transactions:', error)
    } else {
      setTransactions(data || [])
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType)
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory)
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(t => t.transaction_date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter(t => t.transaction_date <= endDate)
    }

    setFilteredTransactions(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const transactionData = {
      company_id: companyId,
      transaction_date: formData.transaction_date,
      category: formData.category,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description || null,
      is_recurring: formData.is_recurring,
    }

    if (editingTransaction) {
      // Update existing
      const { error } = await supabase
        .from('transactions')
        .update(transactionData)
        .eq('id', editingTransaction.id)

      if (error) {
        alert('Error updating transaction: ' + error.message)
      } else {
        await loadTransactions()
        closeModal()
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('transactions')
        .insert(transactionData)

      if (error) {
        alert('Error creating transaction: ' + error.message)
      } else {
        await loadTransactions()
        closeModal()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error deleting transaction: ' + error.message)
    } else {
      await loadTransactions()
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      transaction_date: transaction.transaction_date,
      category: transaction.category,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description || '',
      is_recurring: transaction.is_recurring,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTransaction(null)
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
      category: 'Sales Revenue',
      type: 'Inflow',
      amount: '',
      description: '',
      is_recurring: false,
    })
  }

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Type', 'Amount', 'Description', 'Recurring']
    const rows = filteredTransactions.map(t => [
      t.transaction_date,
      t.category,
      t.type,
      t.amount,
      t.description || '',
      t.is_recurring ? 'Yes' : 'No',
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportExcel = () => {
    const data = filteredTransactions.map(t => ({
      Date: t.transaction_date,
      Category: t.category,
      Type: t.type,
      Amount: t.amount,
      Description: t.description || '',
      Recurring: t.is_recurring ? 'Yes' : 'No',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

    // Auto-size columns
    const maxWidth = data.reduce((w, r) => Math.max(w, r.Description?.length || 0), 10)
    worksheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Category
      { wch: 10 }, // Type
      { wch: 12 }, // Amount
      { wch: Math.min(maxWidth, 50) }, // Description
      { wch: 10 }, // Recurring
    ]

    XLSX.writeFile(workbook, `transactions-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n').slice(1) // Skip header

    const newTransactions = lines
      .filter(line => line.trim())
      .map(line => {
        const [date, category, type, amount, description, recurring] = line.split(',')
        return {
          company_id: companyId,
          transaction_date: date.trim(),
          category: category.trim(),
          type: type.trim() as 'Inflow' | 'Outflow',
          amount: parseFloat(amount.trim()),
          description: description?.trim() || null,
          is_recurring: recurring?.trim().toLowerCase() === 'yes',
        }
      })

    const { error } = await supabase
      .from('transactions')
      .insert(newTransactions)

    if (error) {
      alert('Error uploading CSV: ' + error.message)
    } else {
      alert(`Successfully uploaded ${newTransactions.length} transactions`)
      await loadTransactions()
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const newTransactions = jsonData.map((row: any) => ({
          company_id: companyId,
          transaction_date: row.Date || row.date,
          category: row.Category || row.category,
          type: (row.Type || row.type) as 'Inflow' | 'Outflow',
          amount: parseFloat(row.Amount || row.amount),
          description: row.Description || row.description || null,
          is_recurring: (row.Recurring || row.recurring)?.toString().toLowerCase() === 'yes',
        }))

        const { error } = await supabase
          .from('transactions')
          .insert(newTransactions)

        if (error) {
          alert('Error uploading Excel: ' + error.message)
        } else {
          alert(`Successfully uploaded ${newTransactions.length} transactions`)
          await loadTransactions()
        }
      } catch (error) {
        alert('Error reading Excel file: ' + (error as Error).message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const totalInflows = filteredTransactions
    .filter(t => t.type === 'Inflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutflows = filteredTransactions
    .filter(t => t.type === 'Outflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const netCashFlow = totalInflows - totalOutflows

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaction Management</h1>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
          <nav className="flex gap-4 border-t pt-4 mt-4 flex-wrap">
            <Button onClick={() => router.push('/dashboard')} variant="outline" size="sm">
              Dashboard
            </Button>
            <Button onClick={() => router.push('/transactions')} variant="default" size="sm">
              Transactions
            </Button>
            <Button onClick={() => router.push('/actuals-vs-forecast')} variant="outline" size="sm">
              Actuals vs Forecast
            </Button>
            <Button onClick={() => router.push('/analytics')} variant="outline" size="sm">
              Analytics
            </Button>
            <Button onClick={() => router.push('/chat')} variant="outline" size="sm">
              Ask CFO
            </Button>
          </nav>
          <div className="hidden">
            <div className="flex items-center gap-4">
              <Button onClick={() => router.push('/dashboard')} variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Inflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalInflows)}</div>
              <p className="text-xs text-muted-foreground">{filteredTransactions.filter(t => t.type === 'Inflow').length} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Outflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOutflows)}</div>
              <p className="text-xs text-muted-foreground">{filteredTransactions.filter(t => t.type === 'Outflow').length} transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Cash Flow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netCashFlow)}
              </div>
              <p className="text-xs text-muted-foreground">{filteredTransactions.length} total transactions</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Filters</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowModal(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
                <Button onClick={downloadTemplate} variant="outline" size="sm" className="bg-blue-50 hover:bg-blue-100 border-blue-300">
                  <FileDown className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button onClick={exportExcel} variant="outline" size="sm" className="bg-green-50 hover:bg-green-100">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button onClick={exportCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="bg-green-50 hover:bg-green-100">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import Excel
                  </Button>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </label>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="Inflow">Inflow</option>
                <option value="Outflow">Outflow</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />

              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Description</th>
                    <th className="text-center py-3 px-4">Recurring</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No transactions found. Add your first transaction to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(transaction => (
                      <tr key={transaction.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{new Date(transaction.transaction_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{transaction.category}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            transaction.type === 'Inflow'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${
                          transaction.type === 'Inflow' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{transaction.description || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {transaction.is_recurring ? '✓' : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Inflow' | 'Outflow' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="Inflow">Inflow</option>
                  <option value="Outflow">Outflow</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="recurring" className="text-sm font-medium">Recurring Transaction</label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingTransaction ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
