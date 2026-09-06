import jsPDF from 'jspdf'
import type { Test, TestQuestion } from 'shared'

export function generateExamPaper(test: Test, questions: TestQuestion[], docTitle: string): void {
  const doc = new jsPDF()
  const margin = 20
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = margin

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Note2Test — Exam Paper', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Topic: ${test.topic}`, margin, y)
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y)
  y += 6
  doc.text(`Document: ${docTitle}`, margin, y)
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  doc.text(`Total Marks: ${totalMarks}`, 140, y)
  y += 4

  doc.setLineWidth(0.3)
  doc.line(margin, y, 190, y)
  y += 8

  const letters = ['A', 'B', 'C', 'D']

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const lines = doc.splitTextToSize(`${i + 1}. ${q.question}`, 155)

    const opts: string[] | null =
      typeof q.options === 'string' ? JSON.parse(q.options) : q.options
    const optionHeight = opts ? opts.length * 6 : q.marks * 8
    const needed = lines.length * 6 + optionHeight + 10

    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(lines, margin, y)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`[${q.marks} mark${q.marks !== 1 ? 's' : ''}]`, 185, y, { align: 'right' })
    y += lines.length * 6 + 2

    if (opts && opts.length > 0) {
      for (let idx = 0; idx < opts.length; idx++) {
        const optLines = doc.splitTextToSize(`[ ] ${letters[idx]}. ${opts[idx]}`, 148)
        doc.text(optLines, margin + 6, y)
        y += optLines.length * 5 + 1
      }
    } else {
      doc.setDrawColor(180, 180, 180)
      for (let l = 0; l < q.marks; l++) {
        doc.line(margin + 6, y + 2, 185, y + 2)
        y += 8
      }
    }
    y += 6
  }

  const filename = `exam-${test.topic.replace(/\s+/g, '-').toLowerCase()}.pdf`
  doc.save(filename)
}
