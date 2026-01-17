import { useTranslation } from 'react-i18next'

const AboutUs = () => {
  const { t } = useTranslation()

  const teamMembers = [
    {
      name: 'Maria Rodriguez',
      position: t('about_us.ceo'),
      image: 'https://randomuser.me/api/portraits/women/1.jpg',
      bio: t('about_us.ceo_bio')
    },
    {
      name: 'Carlos Sanchez',
      position: t('about_us.cto'),
      image: 'https://randomuser.me/api/portraits/men/2.jpg',
      bio: t('about_us.cto_bio')
    },
    {
      name: 'Ana Lopez',
      position: t('about_us.cmo'),
      image: 'https://randomuser.me/api/portraits/women/3.jpg',
      bio: t('about_us.cmo_bio')
    },
    {
      name: 'Javier Martinez',
      position: t('about_us.coo'),
      image: 'https://randomuser.me/api/portraits/men/4.jpg',
      bio: t('about_us.coo_bio')
    }
  ]

  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold neon-title mb-6">
            {t('about_us.title')}
          </h1>
          <p className="text-lg text-[#e0e0e0] mb-8">
            {t('about_us.description')}
          </p>

          {/* Our Story */}
          <div className="page-card p-0 overflow-hidden mb-12">
            <div className="bg-[#00D9FF] h-3"></div>
            <div className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t('about_us.story_title')}
              </h2>
              <div className="prose max-w-none text-[#e0e0e0]">
                <p className="mb-4">{t('about_us.story_p1')}</p>
                <p className="mb-4">{t('about_us.story_p2')}</p>
                <p>{t('about_us.story_p3')}</p>
              </div>
            </div>
          </div>

          {/* Our Mission */}
          <div className="page-card p-0 overflow-hidden mb-12">
            <div className="bg-[#00D9FF] h-3"></div>
            <div className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t('about_us.mission_title')}
              </h2>
              <div className="prose max-w-none text-[#e0e0e0]">
                <p className="mb-4">{t('about_us.mission_p1')}</p>
                <p>{t('about_us.mission_p2')}</p>
              </div>
            </div>
          </div>

          {/* Our Values */}
          <div className="page-card p-0 overflow-hidden mb-12">
            <div className="bg-[#00D9FF] h-3"></div>
            <div className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t('about_us.values_title')}
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6 mt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1a1f3a] rounded-full h-10 w-10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-[#00D9FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t('about_us.value1_title')}</h3>
                  <p className="text-[#e0e0e0]">{t('about_us.value1_desc')}</p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1a1f3a] rounded-full h-10 w-10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-[#00D9FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t('about_us.value2_title')}</h3>
                  <p className="text-[#e0e0e0]">{t('about_us.value2_desc')}</p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1a1f3a] rounded-full h-10 w-10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-[#00D9FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{t('about_us.value3_title')}</h3>
                  <p className="text-[#e0e0e0]">{t('about_us.value3_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Our Team */}
          <div className="page-card p-0 overflow-hidden mb-12">
            <div className="bg-[#00D9FF] h-3"></div>
            <div className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t('about_us.team_title')}
              </h2>
              <p className="text-[#e0e0e0] mb-6">{t('about_us.team_desc')}</p>
              
              <div className="grid md:grid-cols-2 gap-8">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex space-x-4">
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="h-24 w-24 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{member.name}</h3>
                      <p className="text-[#00D9FF] mb-2">{member.position}</p>
                      <p className="text-[#e0e0e0] text-sm">{member.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Join Us */}
          <div className="page-card text-center">
            <h3 className="text-2xl font-semibold text-white mb-4">
              {t('about_us.join_title')}
            </h3>
            <p className="text-[#e0e0e0] mb-6 max-w-2xl mx-auto">
              {t('about_us.join_description')}
            </p>
            <div className="flex justify-center space-x-4">
              <button className="neon-cta font-black px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105">
                {t('about_us.careers_button')}
              </button>
              <button className="bg-transparent text-[#00D9FF] border border-[#00D9FF]/30 px-6 py-3 rounded-xl font-medium hover:bg-white/5 transition-colors">
                {t('nav.contact')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AboutUs





