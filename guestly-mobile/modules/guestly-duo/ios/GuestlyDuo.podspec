Pod::Spec.new do |s|
  s.name           = 'GuestlyDuo'
  s.version        = '1.0.0'
  s.summary        = 'iPhone Duo reserved regions (the fold and the cameras) for React Native.'
  s.description    = 'Local Guest-ly module: reads UIView.reservedRegions (iOS 27.1) so layouts can keep interactive content off the fold. React Native has no API for it.'
  s.author         = 'ZC Ventures LLC'
  s.homepage       = 'https://guest-ly.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
