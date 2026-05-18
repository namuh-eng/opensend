# frozen_string_literal: true

require_relative "lib/opensend/version"

Gem::Specification.new do |spec|
  spec.name = "opensend"
  spec.version = OpenSend::VERSION
  spec.summary = "Ruby SDK for the OpenSend email API"
  spec.description = "Minimal first-party Ruby SDK for OpenSend transactional email sends with a familiar API surface."
  spec.authors = ["OpenSend"]
  spec.homepage = "https://github.com/namuh-eng/opensend"
  # RubyGems 3.0 does not recognize Elastic-2.0 as SPDX, so keep builds warning-free
  # while linking to the repository license below.
  spec.license = "Nonstandard"
  spec.required_ruby_version = ">= 2.6"
  spec.metadata = {
    "homepage_uri" => spec.homepage,
    "source_code_uri" => "https://github.com/namuh-eng/opensend",
    "bug_tracker_uri" => "https://github.com/namuh-eng/opensend/issues",
    "license_uri" => "https://github.com/namuh-eng/opensend/blob/main/LICENSE"
  }

  spec.files = Dir["lib/**/*.rb", "README.md", "opensend.gemspec"]
  spec.require_paths = ["lib"]
end
