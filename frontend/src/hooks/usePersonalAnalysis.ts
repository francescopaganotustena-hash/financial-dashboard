import { useMutation } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import type {
  PersonalAnalysisCatalogResponse,
  PersonalAnalysisRequest,
  PersonalAnalysisResponse,
} from '../types/personalAnalysis.types'

async function postPersonalAnalysis(payload: PersonalAnalysisRequest): Promise<PersonalAnalysisResponse> {
  const response = await axios.post<PersonalAnalysisResponse>(`${API_BASE_URL}/api/personal-analysis`, payload)
  return response.data
}

export function usePersonalAnalysis() {
  return useMutation({
    mutationFn: postPersonalAnalysis,
  })
}

async function fetchPersonalAnalysisCatalog(): Promise<PersonalAnalysisCatalogResponse> {
  const response = await axios.get<PersonalAnalysisCatalogResponse>(`${API_BASE_URL}/api/personal-analysis/catalog`)
  return response.data
}

export function usePersonalAnalysisCatalog() {
  return useQuery({
    queryKey: ['personalAnalysisCatalog'],
    queryFn: fetchPersonalAnalysisCatalog,
    staleTime: 6 * 60 * 60 * 1000,
  })
}
