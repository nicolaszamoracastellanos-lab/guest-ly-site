Pod::Spec.new do |s|
  s.name           = 'GuestlyWatch'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge between the Guest-ly iPhone app and its Apple Watch app.'
  s.description    = 'Local Guest-ly module: sends the watch its snapshot and carries the watch actions back to JS.'
  s.author         = 'ZC Ventures LLC'
  s.homepage       = 'https://guest-ly.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
