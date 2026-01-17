import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plane, Calendar, MapPin, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requestPricingPrediction } from '@/services/pricing'

const defaultForm = {
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: '',
  passengers: '1',
  cabinClass: 'economy',
}

const FlightPricePredictor = () => {
  const { t } = useTranslation()

  const [formData, setFormData] = useState(defaultForm)
  const [prediction, setPrediction] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [gatewayPrediction, setGatewayPrediction] = useState(null)
  const [isGatewayLoading, setIsGatewayLoading] = useState(false)
  const [gatewayError, setGatewayError] = useState(null)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setPrediction(null)

    try {
      const { predictFlightPriceML } = await import('../services/mlFlightPredictor')
      const predictionResult = await predictFlightPriceML(formData)
      setPrediction(predictionResult)
    } catch (err) {
      console.error('Error predicting flight prices with ML:', err)
      setError(t('flight_predictor.error_message'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGatewayCheck = async () => {
    if (!formData.origin || !formData.destination || !formData.departureDate) {
      setGatewayError('Completa origen, destino y fecha de salida antes de consultar el gateway.')
      return
    }

    setGatewayError(null)
    setGatewayPrediction(null)
    setIsGatewayLoading(true)

    try {
      const response = await requestPricingPrediction({
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        date: formData.departureDate,
      })
      const first = response?.predictions?.[0]
      if (first) {
        setGatewayPrediction(first)
      } else {
        setGatewayError('No recibimos predicciones del gateway.')
      }
    } catch (err) {
      console.error('Gateway pricing error', err)
      setGatewayError('No pudimos contactar al gateway. Intenta nuevamente en unos minutos.')
    } finally {
      setIsGatewayLoading(false)
    }
  }

  const confidencePercent = (value) => {
    if (value == null) return '--'
    return `${Math.round(value * 100)}%`
  }

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">{t('flight_predictor.title')}</h2>
          <p className="text-xl text-[#a0a0a0] max-w-3xl mx-auto">
            {t('flight_predictor.description')}
          </p>
          <p className="text-md text-indigo-600 mt-2 font-medium">
            {t('flight_predictor.ml_powered')}
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                <CardTitle>{t('flight_predictor.form_title')}</CardTitle>
                <CardDescription className="text-blue-100">
                  {t('flight_predictor.form_description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="origin" className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                        {t('flight_predictor.origin_label')}
                      </Label>
                      <Input
                        id="origin"
                        type="text"
                        placeholder={t('flight_predictor.origin_placeholder')}
                        value={formData.origin}
                        onChange={(e) => handleInputChange('origin', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="destination" className="flex items-center">
                        <Plane className="w-4 h-4 mr-2 text-indigo-500" />
                        {t('flight_predictor.destination_label')}
                      </Label>
                      <Input
                        id="destination"
                        type="text"
                        placeholder={t('flight_predictor.destination_placeholder')}
                        value={formData.destination}
                        onChange={(e) => handleInputChange('destination', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="departureDate" className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                        {t('flight_predictor.departure_label')}
                      </Label>
                      <Input
                        id="departureDate"
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => handleInputChange('departureDate', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="returnDate" className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                        {t('flight_predictor.return_label')}
                      </Label>
                      <Input
                        id="returnDate"
                        type="date"
                        value={formData.returnDate}
                        onChange={(e) => handleInputChange('returnDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passengers">{t('flight_predictor.passengers_label')}</Label>
                      <Input
                        id="passengers"
                        type="number"
                        min="1"
                        value={formData.passengers}
                        onChange={(e) => handleInputChange('passengers', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cabinClass">{t('flight_predictor.cabin_class_label')}</Label>
                      <Select
                        value={formData.cabinClass}
                        onValueChange={(value) => handleInputChange('cabinClass', value)}
                      >
                        <SelectTrigger id="cabinClass">
                          <SelectValue placeholder={t('flight_predictor.cabin_class_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="economy">{t('flight_predictor.economy')}</SelectItem>
                          <SelectItem value="premium_economy">{t('flight_predictor.premium_economy')}</SelectItem>
                          <SelectItem value="business">{t('flight_predictor.business')}</SelectItem>
                          <SelectItem value="first">{t('flight_predictor.first')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white md:w-auto"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('flight_predictor.predicting')}
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          {t('flight_predictor.predict_button')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full md:w-auto"
                      onClick={handleGatewayCheck}
                      disabled={isGatewayLoading}
                    >
                      {isGatewayLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Consultando gateway...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Consultar gateway (beta)
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="shadow-lg border-0 h-full">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
                <CardTitle>{t('flight_predictor.results_title')}</CardTitle>
                <CardDescription className="text-indigo-100">
                  {t('flight_predictor.results_description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
                    <p className="text-[#a0a0a0]">{t('flight_predictor.loading_message')}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-[#1a1f3a] text-[#FF006E] p-4 rounded-lg">
                    {error}
                  </div>
                )}

                {!isLoading && !error && !prediction && (
                  <div className="text-center py-12 text-[#a0a0a0]">
                    <Plane className="h-12 w-12 mx-auto mb-4 text-[#a0a0a0]" />
                    <p>{t('flight_predictor.no_prediction_yet')}</p>
                  </div>
                )}

                {prediction && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600 mb-1">{t('flight_predictor.min_price')}</p>
                        <p className="text-2xl font-bold">${prediction.minPrice}</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <p className="text-sm text-indigo-600 mb-1">{t('flight_predictor.max_price')}</p>
                        <p className="text-2xl font-bold">${prediction.maxPrice}</p>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-purple-600 mb-1">{t('flight_predictor.best_time_to_book')}</p>
                      <p className="text-xl font-semibold">{prediction.bestTimeToBook} {t('flight_predictor.days_before')}</p>
                    </div>

                    <div className="bg-[#0a0e27] p-4 rounded-lg">
                      <p className="text-sm text-[#a0a0a0] mb-1">{t('flight_predictor.price_confidence')}</p>
                      <div className="w-full bg-[#2d3548] rounded-full h-2.5">
                        <div
                          className="bg-green-600 h-2.5 rounded-full"
                          style={{ width: `${prediction.priceConfidence}%` }}
                        ></div>
                      </div>
                      <p className="text-right text-sm mt-1">{prediction.priceConfidence}%</p>
                    </div>

                    {prediction.factors && (
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-amber-700 mb-2">{t('flight_predictor.price_factors')}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#a0a0a0]">{t('flight_predictor.seasonality_factor')}:</span>
                            <span className="font-medium">{prediction.factors.seasonality}x</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#a0a0a0]">{t('flight_predictor.advance_booking_factor')}:</span>
                            <span className="font-medium">{prediction.factors.advanceBooking}x</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#a0a0a0]">{t('flight_predictor.route_factor')}:</span>
                            <span className="font-medium">{prediction.factors.route}x</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#a0a0a0]">{t('flight_predictor.cabin_class_factor')}:</span>
                            <span className="font-medium">{prediction.factors.cabinClass}x</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4">
                      <p className="text-sm font-medium text-[#e0e0e0] mb-2">{t('flight_predictor.price_history')}</p>
                      <div className="flex items-end justify-between h-32 mt-2">
                        {prediction.priceHistory.map((item, index) => {
                          const height = (item.price / 600) * 100
                          return (
                            <div key={index} className="flex flex-col items-center">
                              <div
                                className="w-6 bg-gradient-to-t from-blue-500 to-indigo-600 rounded-t"
                                style={{ height: `${height}%` }}
                              ></div>
                              <span className="text-xs mt-1 text-[#a0a0a0]">{item.month}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      Gateway (beta)
                    </h3>
                    {gatewayPrediction?.next_check_at && (
                      <span className="text-xs text-[#a0a0a0]">
                        Prximo check: {new Date(gatewayPrediction.next_check_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {isGatewayLoading && (
                    <div className="flex items-center gap-3 text-indigo-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Consultando gateway...</span>
                    </div>
                  )}

                  {gatewayError && (
                    <div className="bg-[#1a1f3a] text-[#FF006E] p-4 rounded-lg mb-4">
                      {gatewayError}
                    </div>
                  )}

                  {!isGatewayLoading && !gatewayError && !gatewayPrediction && (
                    <p className="text-sm text-[#a0a0a0]">An no consultas el gateway.</p>
                  )}

                  {gatewayPrediction && (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#a0a0a0]">Precio estimado</span>
                        <span className="text-2xl font-semibold text-white">
                          ${gatewayPrediction.current_price ?? '--'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-[#a0a0a0]">
                        <div>
                          <p className="font-medium text-[#e0e0e0]">Accin sugerida</p>
                          <p className="capitalize">{gatewayPrediction.action}</p>
                        </div>
                        <div>
                          <p className="font-medium text-[#e0e0e0]">Confianza</p>
                          <p>{confidencePercent(gatewayPrediction.confidence)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-[#e0e0e0]">Origen</p>
                          <p>{gatewayPrediction.origin}</p>
                        </div>
                        <div>
                          <p className="font-medium text-[#e0e0e0]">Destino</p>
                          <p>{gatewayPrediction.destination}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="text-xs text-[#a0a0a0] italic">
                {t('flight_predictor.disclaimer')}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FlightPricePredictor


