import { useTranslation } from "react-i18next";

const Solutions = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            {t("solutions.title")}
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            {t("solutions.description")}
          </p>

          {/* Solutions Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {[
              {
                title: t("footer.business"),
                desc: t("solutions.business_desc"),
                features: [
                  t("solutions.business_feature1"),
                  t("solutions.business_feature2"),
                  t("solutions.business_feature3"),
                ],
              },
              {
                title: t("footer.agencies"),
                desc: t("solutions.agencies_desc"),
                features: [
                  t("solutions.agencies_feature1"),
                  t("solutions.agencies_feature2"),
                  t("solutions.agencies_feature3"),
                ],
              },
              {
                title: t("footer.enterprise"),
                desc: t("solutions.enterprise_desc"),
                features: [
                  t("solutions.enterprise_feature1"),
                  t("solutions.enterprise_feature2"),
                  t("solutions.enterprise_feature3"),
                ],
              },
              {
                title: t("solutions.custom_title"),
                desc: t("solutions.custom_desc"),
                features: [
                  t("solutions.custom_feature1"),
                  t("solutions.custom_feature2"),
                  t("solutions.custom_feature3"),
                ],
              },
            ].map((solution, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 h-2" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {solution.title}
                  </h3>
                  <p className="text-gray-700 mb-4">{solution.desc}</p>
                  <ul className="space-y-2 text-gray-700 list-disc list-inside marker:text-teal-500">
                    {solution.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-800 leading-relaxed"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-teal-100 via-teal-50 to-white rounded-2xl p-8 text-center shadow-inner border border-teal-100">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              {t("solutions.cta_title")}
            </h3>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              {t("solutions.cta_description")}
            </p>
            <button className="bg-teal-600 text-white px-6 py-3 rounded-full font-medium hover:bg-teal-700 transition-colors shadow-md">
              {t("nav.request_demo")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Solutions;
