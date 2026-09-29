Pod::Spec.new do |s|
  s.name           = 'Storefront'
  s.version        = '1.0.0'
  s.summary        = 'Reads the App Store storefront country code from StoreKit 2.'
  s.description    = 'Local Guest-ly module: StoreKit 2 Storefront.current.countryCode for the US-only external link rule.'
  s.author         = 'ZC Ventures LLC'
  s.homepage       = 'https://guest-ly.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
