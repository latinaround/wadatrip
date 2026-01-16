import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Navigation, Calendar, Users, DollarSign, Search as SearchIcon, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Hero = ({ onSearch }) => {
  const { t } = useTranslation();
  const [searchData, setSearchData] = useState({
    origin: '',
    destination: '',
    startDate: '',
    tripLength: '5',
    travelers: '1',
    budget: 'medium',
    interests: '',
  });

  const handleInputChange = (field, value) => {
    setSearchData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch?.(searchData);
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 flex items-center pt-16">
      <div className="absolute inset-0 opacity-40">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            {t('hero.title')}
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-orange-400 bg-clip-text text-transparent">
              {t('hero.subtitle')}
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-3xl mx-auto">
            {t('hero.description')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-white font-medium flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-teal-300" />
                  {t('hero.origin_label', 'Origen')}
                </Label>
                <Input
                  id="origin"
                  type="text"
                  placeholder={t('hero.origin_placeholder', 'Ciudad de salida')}
                  value={searchData.origin}
                  onChange={(e) => handleInputChange('origin', e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-gray-300 focus:border-teal-400 focus:ring-teal-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="text-white font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  {t('hero.destination_label')}
                </Label>
                <Input
                  id="destination"
                  type="text"
                  placeholder={t('hero.destination_placeholder')}
                  value={searchData.destination}
                  onChange={(e) => handleInputChange('destination', e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-gray-300 focus:border-teal-400 focus:ring-teal-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-white font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  {t('hero.dates_label')}
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={searchData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="bg-white/20 border-white/30 text-white focus:border-blue-400 focus:ring-blue-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white font-medium flex items-center gap-2">
                  <Timer className="w-4 h-4 text-purple-300" />
                  {t('hero.length_label', 'Duration (days)')}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="21"
                  value={searchData.tripLength}
                  onChange={(e) => handleInputChange('tripLength', e.target.value)}
                  className="bg-white/20 border-white/30 text-white focus:border-purple-400 focus:ring-purple-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2 text-green-400" />
                  {t('hero.travelers_label')}
                </Label>
                <Select value={searchData.travelers} onValueChange={(value) => handleInputChange('travelers', value)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white focus:border-green-400 focus:ring-green-400">
                    <SelectValue placeholder={t('hero.travelers_select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {t(`traveler_options.${num}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white font-medium flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-yellow-400" />
                  {t('hero.budget_label')}
                </Label>
                <Select value={searchData.budget} onValueChange={(value) => handleInputChange('budget', value)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white focus:border-yellow-400 focus:ring-yellow-400">
                    <SelectValue placeholder={t('hero.budget_select')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('budget_options.low')}</SelectItem>
                    <SelectItem value="medium">{t('budget_options.medium')}</SelectItem>
                    <SelectItem value="high">{t('budget_options.high')}</SelectItem>
                    <SelectItem value="luxury">{t('budget_options.luxury')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="interests" className="text-white font-medium">
                  {t('hero.interests_label')}
                </Label>
                <Input
                  id="interests"
                  type="text"
                  placeholder={t('hero.interests_placeholder')}
                  value={searchData.interests}
                  onChange={(e) => handleInputChange('interests', e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-gray-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
            </div>

            <div className="text-center">
              <Button
                type="submit"
                size="lg"
                className="bg-gradient-to-r from-teal-500 to-orange-500 hover:from-teal-600 hover:to-orange-600 text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <SearchIcon className="w-5 h-5 mr-2" />
                {t('hero.generate_button')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Hero;
