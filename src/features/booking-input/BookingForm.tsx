import { useState, useEffect } from 'react'
import { Booking } from '../../shared/types'

interface Props {
  onSubmit: (booking: Omit<Booking, 'id'>) => void
  initialValues?: Booking
  onCancel?: () => void
}

const emptyValues = {
  name: '',
  revenue: '',
  bookingDate: '',
  startDate: '',
  endDate: '',
}

type FormValues = typeof emptyValues

export function BookingForm({ onSubmit, initialValues, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [errors, setErrors] = useState<Partial<FormValues>>({})

  useEffect(() => {
    if (initialValues) {
      setValues({
        name: initialValues.name,
        revenue: String(initialValues.revenue),
        bookingDate: initialValues.bookingDate,
        startDate: initialValues.startDate,
        endDate: initialValues.endDate,
      })
    } else {
      setValues(emptyValues)
    }
    setErrors({})
  }, [initialValues])

  function validate(): Partial<FormValues> {
    const errs: Partial<FormValues> = {}
    if (!values.name.trim()) errs.name = 'Required'
    if (!values.revenue || Number(values.revenue) <= 0) errs.revenue = 'Must be greater than 0'
    if (!values.bookingDate) errs.bookingDate = 'Required'
    if (!values.startDate) errs.startDate = 'Required'
    if (!values.endDate) errs.endDate = 'Required'
    if (values.startDate && values.endDate && values.startDate >= values.endDate)
      errs.endDate = 'Must be after check-in date'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit({
      name: values.name.trim(),
      revenue: Number(values.revenue),
      bookingDate: values.bookingDate,
      startDate: values.startDate,
      endDate: values.endDate,
    })
    if (!initialValues) {
      setValues(emptyValues)
      setErrors({})
    }
  }

  function setField(key: keyof FormValues, value: string) {
    setValues(v => ({ ...v, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <h2>{initialValues ? 'Edit Booking' : 'Add Booking'}</h2>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="name">Booking Name</label>
          <input
            id="name"
            type="text"
            value={values.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="Guest or listing name"
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="revenue">Revenue ($)</label>
          <input
            id="revenue"
            type="number"
            value={values.revenue}
            onChange={e => setField('revenue', e.target.value)}
            min="0"
            step="any"
            placeholder="0.00"
          />
          {errors.revenue && <span className="form-error">{errors.revenue}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="bookingDate">Booking Date</label>
          <input
            id="bookingDate"
            type="date"
            value={values.bookingDate}
            onChange={e => setField('bookingDate', e.target.value)}
          />
          {errors.bookingDate && <span className="form-error">{errors.bookingDate}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="startDate">Check-in Date</label>
          <input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={e => setField('startDate', e.target.value)}
          />
          {errors.startDate && <span className="form-error">{errors.startDate}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="endDate">Check-out Date</label>
          <input
            id="endDate"
            type="date"
            value={values.endDate}
            onChange={e => setField('endDate', e.target.value)}
          />
          {errors.endDate && <span className="form-error">{errors.endDate}</span>}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit">{initialValues ? 'Save Changes' : 'Add Booking'}</button>
        {initialValues && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
