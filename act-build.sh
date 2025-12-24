#!/usr/bin/env bash
# This script runs GitHub Actions workflows locally using act

set -e

# Default values
EVENT_NAME="tag"
JOB_NAME=""
VERBOSE=false
EVENT_FILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--event)
            EVENT_NAME="$2"
            shift 2
            ;;
        -j|--job)
            JOB_NAME="$2"
            shift 2
            ;;
        -f|--event-file)
            EVENT_FILE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -e, --event EVENT     Event to trigger (default: tag)"
            echo "                        Options: push (CI), pull_request, tag (Release - includes lint, test, build)"
            echo "  -j, --job JOB         Specific job to run (optional)"
            echo "  -f, --event-file FILE Custom event JSON file"
            echo "  -v, --verbose         Run in verbose mode"
            echo "  -h, --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                  # Test release workflow (default - includes lint, test, build)"
            echo "  $0 --event push                     # Test CI workflow only"
            echo "  $0 --event tag --job lint           # Run only lint job from release workflow"
            echo "  $0 --event push --job test          # Run only test job from CI workflow"
            echo "  $0 --event-file .event.tag.json     # Use custom event file"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "ERROR: act is not installed. Please install it first:"
    echo "  macOS:   brew install act"
    echo "  Linux:   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash -s -- -b /usr/local/bin"
    echo "  Windows: scoop install act"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Build act arguments array
ACT_ARGS=()

# Handle tag event by creating a custom event file
if [ "${EVENT_NAME}" = "tag" ]; then
    EVENT_FILE_TMP=$(mktemp .act-event-XXXXXX.json)
    cat > "${EVENT_FILE_TMP}" <<EOF
{
  "ref": "refs/tags/v1.0.0",
  "ref_type": "tag"
}
EOF
    EVENT_FILE="${EVENT_FILE_TMP}"
    EVENT_NAME="push"  # Tags trigger via push event
    echo "Created tag event file: ${EVENT_FILE}"
fi

# Use custom event file if provided
if [ -n "${EVENT_FILE:-}" ]; then
    ACT_ARGS+=("-e" "${EVENT_FILE}")
else
    ACT_ARGS+=("${EVENT_NAME}")
fi

# Add job filter if specified
if [ -n "${JOB_NAME}" ]; then
    ACT_ARGS+=("-j" "${JOB_NAME}")
fi

# Add remove flag
ACT_ARGS+=("--rm")

# Add env file if it exists
if [ -f ".act.env" ]; then
    ACT_ARGS+=("--env-file" ".act.env")
    [ "${VERBOSE}" = true ] && echo "Using .act.env file"
fi

# Add secrets file if it exists
if [ -f ".act.secrets" ]; then
    ACT_ARGS+=("--secret-file" ".act.secrets")
    [ "${VERBOSE}" = true ] && echo "Using .act.secrets file"
fi

# Add verbose if specified
[ "${VERBOSE}" = true ] && ACT_ARGS+=("-v")

# Cleanup function
cleanup() {
    if [ -n "${EVENT_FILE_TMP:-}" ] && [ -f "${EVENT_FILE_TMP}" ]; then
        rm -f "${EVENT_FILE_TMP}"
    fi
}
trap cleanup EXIT

echo "--------------------------------------------------------------------------------------"
echo "Testing GitHub Actions workflows locally with act"
echo "Event: ${EVENT_NAME}"
[ -n "${JOB_NAME}" ] && echo "Job: ${JOB_NAME}"
echo "--------------------------------------------------------------------------------------"
echo ""

# List available workflows/jobs first
if [ "${VERBOSE}" = true ] || [ -z "${JOB_NAME}" ]; then
    echo "Available workflows/jobs:"
    act --list 2>/dev/null | grep -E "^[0-9]+" || echo "Run 'act --list' to see available jobs"
    echo ""
fi

[ "${VERBOSE}" = true ] && echo "Executing: act ${ACT_ARGS[*]}"
echo ""

# Execute act
act "${ACT_ARGS[@]}"
ACT_EXIT_CODE=$?

if [ ${ACT_EXIT_CODE} -ne 0 ]; then
    echo ""
    echo "ERROR: Workflow test failed (exit code: ${ACT_EXIT_CODE})"
    echo ""
    echo "Tips:"
    echo "  - Use --verbose for detailed output"
    echo "  - Check that Docker is running"
    echo "  - For release workflow, use: $0 --event tag"
    echo "  - For CI workflow, use: $0 --event push"
    exit 1
fi

echo ""
echo "--------------------------------------------------------------------------------------"
echo "Workflow test completed successfully"
echo "--------------------------------------------------------------------------------------"

